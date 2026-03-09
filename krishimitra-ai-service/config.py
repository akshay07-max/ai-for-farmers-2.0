# env vars, Pinecone + Gemini clients

# ================================================================
# CONFIG — loads all env vars and initializes AI clients
# Import from here, never initialize clients in individual files.
# ================================================================
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Env vars ──────────────────────────────────────────────────
GEMINI_API_KEY      = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY    = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "krishimitra-knowledge")
PINECONE_HOST       = os.getenv("PINECONE_HOST")
MONGODB_URI         = os.getenv("MONGODB_URI")
PORT                = int(os.getenv("PORT", 8000))

# Multilingual embedding model — supports Marathi, Hindi, English
# Produces 768-dimensional vectors (matches your Pinecone index dimension)
EMBEDDING_MODEL = "paraphrase-multilingual-mpnet-base-v2"

# ── Gemini client ─────────────────────────────────────────────
gemini_model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={
                "temperature":       0.4,
                "top_p":             0.85,
                "max_output_tokens": 1024,
            },
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT",        "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH",       "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
        )
        logger.info("Gemini initialized (gemini-1.5-flash)")
    except Exception as e:
        logger.error(f"Gemini init failed: {e}")
else:
    logger.warning("GEMINI_API_KEY not set")

# ── Pinecone client ───────────────────────────────────────────
pinecone_index = None
if PINECONE_API_KEY and PINECONE_HOST:
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=PINECONE_API_KEY)
        pinecone_index = pc.Index(host=PINECONE_HOST)
        logger.info("Pinecone initialized")
    except Exception as e:
        logger.error(f"Pinecone init failed: {e}")
else:
    logger.warning("Pinecone credentials not set")

# ── Embedding model (lazy loaded on first use) ────────────────
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        logger.info("Loading embedding model — first time takes ~30 seconds...")
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
        logger.info("Embedding model loaded")
    return _embedding_model

def embed_text(text: str) -> list:
    """Convert a single string to a 768-dim vector."""
    return get_embedding_model().encode(text, normalize_embeddings=True).tolist()

def embed_batch(texts: list) -> list:
    """Convert a list of strings to vectors — faster than one at a time."""
    return get_embedding_model().encode(texts, normalize_embeddings=True).tolist()