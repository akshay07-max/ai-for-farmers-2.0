# Pydantic request/response models

# ================================================================
# SCHEMAS — Pydantic models for all request/response validation
# FastAPI uses these automatically for request parsing + API docs
# ================================================================
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class Language(str, Enum):
    mr = "mr"   # Marathi
    hi = "hi"   # Hindi
    en = "en"   # English


# ── Chat schemas ──────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str           # "user" or "model"
    content: str


class ChatRequest(BaseModel):
    message:  str       = Field(..., min_length=1, max_length=2000)
    userId:   str       = Field(..., description="MongoDB user ID")
    language: Language  = Language.mr
    # Full conversation history — passed from Node.js on every request
    # (Python has no session — Node.js manages history in MongoDB)
    history:  List[ChatMessage] = []
    # Farmer context — passed from user profile for personalized answers
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    answer:      str
    language:    str
    sources:     List[str] = []   # which RAG documents were used
    sessionId:   Optional[str] = None


# ── STT (Speech-to-Text) schemas ──────────────────────────────

class STTResponse(BaseModel):
    transcript:       str
    language_detected: str
    confidence:       float


# ── TTS (Text-to-Speech) schemas ──────────────────────────────

class TTSRequest(BaseModel):
    text:     str      = Field(..., min_length=1, max_length=1000)
    language: Language = Language.mr


# ── RAG schemas ───────────────────────────────────────────────

class IngestRequest(BaseModel):
    # For text content ingested directly (not file upload)
    content:   str
    title:     str
    category:  str   # "crop_disease", "fertilizer", "market", "weather", "scheme"
    language:  Language = Language.mr
    source:    Optional[str] = None


class IngestResponse(BaseModel):
    chunks_stored: int
    title:         str
    message:       str


class QueryRequest(BaseModel):
    query:     str
    language:  Language = Language.mr
    top_k:     int      = 5        # how many relevant chunks to retrieve
    category:  Optional[str] = None  # filter by category


class QueryResponse(BaseModel):
    results:  List[dict]
    query:    str