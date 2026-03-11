# ================================================================
# CONFIG — loads all env vars and initializes AI clients
# ================================================================
import os
import sys
import logging
from dotenv import load_dotenv

# Fix for Windows — ensures all files in this folder are importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
# Produces 768-dimensional vectors (must match your Pinecone index dimension)
EMBEDDING_MODEL = "paraphrase-multilingual-mpnet-base-v2"

# ── Gemini client (new google-genai SDK) ──────────────────────
gemini_client = None
GEMINI_MODEL  = "gemini-2.0-flash"

if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info(f"✅ Gemini initialized ({GEMINI_MODEL})")
    except Exception as e:
        logger.error(f"❌ Gemini init failed: {e}")
else:
    logger.warning("⚠️  GEMINI_API_KEY not set")

# Alias — so existing code that references gemini_model still works
gemini_model = gemini_client

# ── Pinecone client ───────────────────────────────────────────
pinecone_index = None
if PINECONE_API_KEY and PINECONE_HOST:
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=PINECONE_API_KEY)
        pinecone_index = pc.Index(host=PINECONE_HOST)
        logger.info("✅ Pinecone initialized")
    except Exception as e:
        logger.error(f"❌ Pinecone init failed: {e}")
else:
    logger.warning("⚠️  Pinecone credentials not set — check PINECONE_API_KEY and PINECONE_HOST in .env")

# ── Embedding model (lazy loaded on first use) ────────────────
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        logger.info("Loading embedding model — first time takes ~30 seconds...")
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
        logger.info("✅ Embedding model loaded")
    return _embedding_model

def embed_text(text: str) -> list:
    """Convert a single string to a 768-dim vector."""
    return get_embedding_model().encode(text, normalize_embeddings=True).tolist()

def embed_batch(texts: list) -> list:
    """Convert a list of strings to vectors — faster than one at a time."""
    return get_embedding_model().encode(texts, normalize_embeddings=True).tolist()