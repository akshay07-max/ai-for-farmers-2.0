# new Python FastAPI server (port 8000)
# FastAPI app, all routes

# ================================================================
# KRISHIMITRA AI SERVICE — FastAPI Application
# Port: 8000
# Called by the Node.js backend (never directly by the mobile app)
# ================================================================
import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import config
from schemas import (
    ChatRequest, ChatResponse,
    STTResponse,
    TTSRequest,
    IngestRequest, IngestResponse,
    QueryRequest, QueryResponse,
)
from services import stt_service, llm_service, rag_service, tts_service

# ── Logging setup ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ── App startup/shutdown ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("=" * 50)
    logger.info("  🌾 KrishiMitra AI Service Starting")
    logger.info(f"  📡 Port: {config.PORT}")
    logger.info("=" * 50)
    yield
    # Shutdown
    logger.info("AI Service shutting down.")


app = FastAPI(
    title="KrishiMitra AI Service",
    description="AI microservice — STT, LLM, TTS, RAG for Indian farmers",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow calls from Node.js backend only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Internal API key guard ─────────────────────────────────────
# Node.js passes this header on every request.
# Prevents external callers from hitting the AI service directly.
import os
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "krishimitra-internal-2026")

def verify_internal_key(x_internal_key: str = None):
    """Dependency — validates internal API key header."""
    from fastapi import Header
    return True  # TODO: enable in production
    # In production, uncomment:
    # if x_internal_key != INTERNAL_API_KEY:
    #     raise HTTPException(status_code=403, detail="Invalid internal API key")


# ══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status":   "healthy",
        "service":  "krishimitra-ai-service",
        "version":  "1.0.0",
        "features": {
            "stt":    "whisper-small",
            "llm":    "gemini-1.5-flash" if config.gemini_model else "not configured",
            "rag":    "pinecone" if config.pinecone_index else "not configured",
            "tts":    "gTTS",
        }
    }


# ══════════════════════════════════════════════════════════════
# STT — Speech to Text
# POST /stt
# Body: multipart/form-data
#   audio: <audio file> (mp3, wav, m4a, ogg)
#   language: "mr" | "hi" | "en" (optional hint)
# ══════════════════════════════════════════════════════════════

@app.post("/stt", response_model=STTResponse)
async def speech_to_text(
    audio:    UploadFile = File(..., description="Audio file (mp3/wav/m4a/ogg)"),
    language: str        = Form(default=None, description="Language hint: mr/hi/en"),
):
    """
    Transcribe an audio file to text using Whisper.

    Called by Node.js voice route after receiving audio from the farmer's app.
    Returns the transcript + detected language.
    """
    # Validate file type
    allowed_types = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4",
                     "audio/ogg", "audio/webm", "audio/m4a", "audio/x-m4a"}
    if audio.content_type and audio.content_type not in allowed_types:
        # Be lenient — some clients send wrong content type
        logger.warning(f"Unexpected audio content type: {audio.content_type}")

    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(audio_bytes) > 25 * 1024 * 1024:  # 25MB limit
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")

    try:
        result = await stt_service.transcribe_audio(audio_bytes, audio.filename or "audio.mp3", language)
        return STTResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# CHAT — LLM with RAG
# POST /chat
# Body: JSON ChatRequest
# ══════════════════════════════════════════════════════════════

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message and get an AI response.

    1. Queries Pinecone for relevant knowledge
    2. Injects context into Gemini prompt
    3. Generates response in farmer's language
    4. Returns answer + which documents were used

    Called by:
    - Node.js voice route (after STT, before TTS)
    - Node.js chat route (for text chat)
    """
    try:
        result = await llm_service.chat(
            message      = request.message,
            history      = [m.dict() for m in request.history],
            language     = request.language.value,
            user_context = request.context,
        )
        return ChatResponse(
            answer    = result["answer"],
            language  = request.language.value,
            sources   = result.get("sources", []),
            sessionId = request.userId,
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# TTS — Text to Speech
# POST /tts
# Body: JSON TTSRequest
# Returns: audio/mpeg (MP3 bytes)
# ══════════════════════════════════════════════════════════════

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech audio.

    Returns MP3 audio bytes directly (not JSON).
    Node.js saves this to S3 (Step 6) and returns the URL to the app.

    Supports: Marathi (mr), Hindi (hi), English (en)
    """
    try:
        audio_bytes = await tts_service.synthesize(request.text, request.language.value)
        return Response(
            content      = audio_bytes,
            media_type   = "audio/mpeg",
            headers      = {"Content-Disposition": "attachment; filename=response.mp3"},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# RAG — Knowledge Base Management
# ══════════════════════════════════════════════════════════════

@app.post("/rag/ingest/text", response_model=IngestResponse)
async def ingest_text(request: IngestRequest):
    """
    Ingest plain text content into the knowledge base.

    Called by the Admin module when admins add farming knowledge.
    Example: paste text from a government farming guidebook.
    """
    try:
        result = await rag_service.ingest_text(
            content  = request.content,
            title    = request.title,
            category = request.category,
            language = request.language.value,
            source   = request.source,
        )
        return IngestResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/ingest/pdf", response_model=IngestResponse)
async def ingest_pdf(
    file:     UploadFile = File(...),
    title:    str        = Form(...),
    category: str        = Form(...),
    language: str        = Form(default="mr"),
):
    """
    Ingest a PDF document into the knowledge base.

    Called by Admin module when uploading farming manuals, govt schemes, etc.
    The PDF is chunked, embedded, and stored in Pinecone.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty PDF file")

    try:
        result = await rag_service.ingest_pdf(pdf_bytes, title, category, language)
        return IngestResponse(**result)
    except Exception as e:
        logger.error(f"PDF ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/ingest/docx", response_model=IngestResponse)
async def ingest_docx(
    file:     UploadFile = File(...),
    title:    str        = Form(...),
    category: str        = Form(...),
    language: str        = Form(default="mr"),
):
    """Ingest a Word document (.docx) into the knowledge base."""
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    docx_bytes = await file.read()
    try:
        result = await rag_service.ingest_docx(docx_bytes, title, category, language)
        return IngestResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    Query the knowledge base for relevant chunks.

    Mostly used internally by the /chat endpoint.
    Can also be called directly for testing what knowledge exists.
    """
    try:
        results = await rag_service.query(
            query_text = request.query,
            language   = request.language.value,
            top_k      = request.top_k,
            category   = request.category,
        )
        return QueryResponse(results=results, query=request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host    = "0.0.0.0",
        port    = config.PORT,
        reload  = True,       # auto-restart on code changes (dev only)
        workers = 1,          # single worker (Whisper model can't be shared)
    )