# Pinecone vector search + document ingestion


# ================================================================
# RAG SERVICE — Retrieval Augmented Generation using Pinecone
#
# What is RAG?
# Instead of relying only on Gemini's training data, we:
# 1. Store farming knowledge (diseases, schemes, techniques) in Pinecone
# 2. When a farmer asks a question, find the most relevant stored chunks
# 3. Pass those chunks + the question to Gemini
# 4. Gemini answers using REAL, SPECIFIC farming knowledge
#
# This means the AI gives accurate, India-specific answers about:
# - PM-Kisan, crop insurance schemes
# - Maharashtra-specific crop diseases
# - Local mandi rules, MSP prices
# - Organic farming techniques
# ================================================================
import re
import logging
import hashlib
from typing import Optional
from config import pinecone_index, embed_text, embed_batch

logger = logging.getLogger(__name__)


def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list:
    """
    Split a long document into overlapping chunks for storage.

    Why overlap? So that context at chunk boundaries isn't lost.
    Example: chunk_size=400 words, overlap=80 words means each chunk
    shares 80 words with the next chunk.
    """
    words  = text.split()
    chunks = []
    start  = 0

    while start < len(words):
        end   = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap  # overlap with previous chunk

    return chunks


def _make_vector_id(title: str, chunk_index: int) -> str:
    """Generate a unique, reproducible ID for a chunk."""
    raw = f"{title}:chunk:{chunk_index}"
    return hashlib.md5(raw.encode()).hexdigest()


async def ingest_text(content: str, title: str, category: str, language: str, source: str = None) -> dict:
    """
    Ingest a text document into Pinecone.

    Steps:
    1. Split text into chunks
    2. Embed each chunk (text → 768-dim vector)
    3. Upsert into Pinecone with metadata

    Args:
        content:  The full text content to store
        title:    Human-readable title (e.g. "Onion Thrips Management")
        category: "crop_disease" | "fertilizer" | "market" | "weather" |
                  "scheme" | "technique" | "general"
        language: "mr" | "hi" | "en"
        source:   Optional URL or book reference
    """
    if not pinecone_index:
        logger.warning("Pinecone not configured — ingestion skipped")
        return {"chunks_stored": 0, "title": title, "message": "Pinecone not configured"}

    # Clean text
    content = re.sub(r'\s+', ' ', content).strip()
    if len(content) < 50:
        raise ValueError("Content too short (minimum 50 characters)")

    chunks = _chunk_text(content)
    logger.info(f"Ingesting '{title}' — {len(chunks)} chunks")

    # Embed all chunks in one batch (faster than one at a time)
    vectors = embed_batch(chunks)

    # Prepare Pinecone upsert payload
    pinecone_vectors = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        pinecone_vectors.append({
            "id":     _make_vector_id(title, i),
            "values": vector,
            "metadata": {
                "title":    title,
                "category": category,
                "language": language,
                "source":   source or "",
                "chunk":    chunk,          # store the text so we can return it
                "chunk_index": i,
                "total_chunks": len(chunks),
            }
        })

    # Upsert in batches of 100 (Pinecone limit per request)
    batch_size = 100
    total_upserted = 0
    for i in range(0, len(pinecone_vectors), batch_size):
        batch = pinecone_vectors[i:i + batch_size]
        pinecone_index.upsert(vectors=batch)
        total_upserted += len(batch)

    logger.info(f"Ingested '{title}': {total_upserted} chunks stored")
    return {
        "chunks_stored": total_upserted,
        "title":         title,
        "message":       f"Successfully ingested {total_upserted} chunks from '{title}'",
    }


async def ingest_pdf(pdf_bytes: bytes, title: str, category: str, language: str) -> dict:
    """Extract text from a PDF file and ingest it into Pinecone."""
    try:
        import PyPDF2
        import io

        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text   = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"

        if not text.strip():
            raise ValueError("Could not extract text from PDF. The PDF may be image-only (scanned).")

        return await ingest_text(text, title, category, language)

    except ImportError:
        raise RuntimeError("PyPDF2 not installed. Run: pip install pypdf2")


async def ingest_docx(docx_bytes: bytes, title: str, category: str, language: str) -> dict:
    """Extract text from a Word document and ingest it into Pinecone."""
    try:
        import docx
        import io

        doc  = docx.Document(io.BytesIO(docx_bytes))
        text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

        if not text.strip():
            raise ValueError("Could not extract text from Word document.")

        return await ingest_text(text, title, category, language)

    except ImportError:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")


async def query(query_text: str, language: str, top_k: int = 5, category: str = None) -> list:
    """
    Find the most relevant stored chunks for a query.

    Steps:
    1. Embed the query text
    2. Search Pinecone for similar vectors
    3. Return top_k most relevant chunks with their text

    Args:
        query_text: The farmer's question
        language:   Preferred language (filters results)
        top_k:      How many chunks to return (5 is good for context)
        category:   Optional filter — only return results from this category

    Returns:
        List of { text, title, category, score }
    """
    if not pinecone_index:
        logger.warning("Pinecone not configured — returning empty results")
        return []

    query_vector = embed_text(query_text)

    # Build filter — Pinecone metadata filtering
    filter_dict = {}
    if category:
        filter_dict["category"] = {"$eq": category}
    # Note: we search ALL languages — multilingual model handles cross-lingual retrieval
    # A Marathi question can match Hindi/English stored content

    query_params = {
        "vector":          query_vector,
        "top_k":           top_k,
        "include_metadata": True,
    }
    if filter_dict:
        query_params["filter"] = filter_dict

    results = pinecone_index.query(**query_params)

    # Format results
    formatted = []
    for match in results.get("matches", []):
        if match["score"] < 0.3:   # ignore low-relevance results
            continue
        meta = match.get("metadata", {})
        formatted.append({
            "text":     meta.get("chunk", ""),
            "title":    meta.get("title", ""),
            "category": meta.get("category", ""),
            "source":   meta.get("source", ""),
            "score":    round(match["score"], 3),
        })

    logger.info(f"RAG query '{query_text[:40]}...' → {len(formatted)} results")
    return formatted