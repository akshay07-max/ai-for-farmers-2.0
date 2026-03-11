# ================================================================
# LLM SERVICE — Gemini 1.5 Flash with RAG context injection
#
# Flow for every chat message:
# 1. Query Pinecone for relevant farming knowledge
# 2. Build a system prompt with that knowledge as context
# 3. Send to Gemini with full conversation history
# 4. Return answer in the farmer's language
# ================================================================
import logging
from config import gemini_client, GEMINI_MODEL
from services import rag_service

logger = logging.getLogger(__name__)

# ── System prompt ─────────────────────────────────────────────────────────────
# This tells Gemini WHO it is and HOW to behave.
# It's injected at the start of every conversation.
SYSTEM_PROMPT = """You are KrishiMitra, an expert AI assistant for Indian farmers.

YOUR IDENTITY:
- You are a trusted farming advisor who speaks like a knowledgeable, caring friend
- You understand Indian agriculture deeply — Maharashtra crops, Indian weather patterns, government schemes, local market prices
- You are NOT a generic AI — you are specialized for Indian farming

YOUR LANGUAGES:
- Respond in the SAME language the farmer uses
- If they write in Marathi (मराठी), respond in Marathi
- If they write in Hindi (हिंदी), respond in Hindi  
- If they write in English, respond in English
- Use simple, everyday words — NOT technical or English jargon
- For crop/disease names, use local names first: "करपा" not "blight"

YOUR KNOWLEDGE:
- Use the CONTEXT DOCUMENTS provided below as your primary source of truth
- If context documents have relevant info, USE IT and cite the source title
- For questions not covered in context, use your general farming knowledge
- For government schemes, always mention eligibility and how to apply
- For diseases, always mention: symptoms → prevention → treatment → cost estimate

YOUR RESPONSE RULES:
1. Keep answers SHORT and PRACTICAL — max 4-5 sentences for simple questions
2. For complex questions (disease, scheme), use a simple numbered list
3. Always end with ONE actionable step the farmer can do TODAY
4. Never make up prices — say "check your local mandi" if unsure
5. Never recommend a specific brand of pesticide — say "consult your krishi kendra"
6. If a question is completely outside farming, politely redirect: "I'm best at farming questions. For [topic], please consult [relevant expert]."

CRITICAL: You are talking to a farmer, not a scientist. Be warm, practical, and encouraging."""


def _build_context_section(rag_results: list, language: str) -> str:
    """Format RAG results into a context block for the prompt."""
    if not rag_results:
        return ""

    lang_label = {"mr": "मराठी", "hi": "हिंदी", "en": "English"}.get(language, "")

    context = "\n\n--- RELEVANT KNOWLEDGE BASE DOCUMENTS ---\n"
    for i, result in enumerate(rag_results, 1):
        context += f"\n[Document {i}: {result['title']} | Relevance: {result['score']:.0%}]\n"
        context += result["text"] + "\n"
    context += "\n--- END OF DOCUMENTS ---\n"
    context += f"\nUse the above documents to answer in {lang_label}.\n"
    return context


async def chat(message: str, history: list, language: str, user_context: dict = None) -> dict:
    """
    Send a message to Gemini and get a response.

    Args:
        message:      The farmer's current message
        history:      Previous messages [ {role, content}, ... ]
        language:     "mr" | "hi" | "en"
        user_context: { district, primaryCrops, farmSize }

    Returns:
        { answer, sources }
    """
    if not gemini_client:
        fallback = {
            "mr": "माफ करा, AI सेवा सध्या उपलब्ध नाही. कृपया नंतर पुन्हा प्रयत्न करा.",
            "hi": "क्षमा करें, AI सेवा अभी उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।",
            "en": "Sorry, the AI service is temporarily unavailable. Please try again later.",
        }
        return {"answer": fallback.get(language, fallback["en"]), "sources": []}

    # ── Step 1: RAG — find relevant knowledge ─────────────────
    rag_results     = await rag_service.query(message, language, top_k=4)
    context_section = _build_context_section(rag_results, language)

    # ── Step 2: Build farmer context ──────────────────────────
    farmer_context = ""
    if user_context:
        parts = []
        if user_context.get("district"):
            parts.append(f"District: {user_context['district']}")
        if user_context.get("primaryCrops"):
            parts.append(f"Crops: {', '.join(user_context['primaryCrops'])}")
        if user_context.get("farmSize"):
            parts.append(f"Farm size: {user_context['farmSize']} acres")
        if parts:
            farmer_context = f"\nFARMER PROFILE: {' | '.join(parts)}\n"

    # ── Step 3: Build full prompt ──────────────────────────────
    # New SDK uses a simple contents list.
    # We prepend system prompt + context as the first user turn,
    # then append conversation history, then the current message.
    full_system = SYSTEM_PROMPT + farmer_context + context_section

    contents = []

    # System context as first turn
    contents.append({"role": "user",  "parts": [{"text": full_system}]})
    contents.append({"role": "model", "parts": [{"text": "Understood. I am KrishiMitra, ready to help farmers."}]})

    # Conversation history
    for msg in history:
        role = "model" if msg["role"] in ("model", "assistant") else "user"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    # Current message
    contents.append({"role": "user", "parts": [{"text": message}]})

    # ── Step 4: Call Gemini (new SDK) ─────────────────────────
    try:
        from google import genai as _genai
        from google.genai import types

        response = gemini_client.models.generate_content(
            model    = GEMINI_MODEL,
            contents = contents,
            config   = types.GenerateContentConfig(
                temperature      = 0.4,
                top_p            = 0.85,
                max_output_tokens= 1024,
            ),
        )
        answer  = response.text.strip()
        sources = [r["title"] for r in rag_results if r["score"] > 0.5]

        logger.info(f"LLM: '{message[:40]}' | rag={len(rag_results)} | ans_len={len(answer)}")
        return {"answer": answer, "sources": sources}

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        fallback = {
            "mr": "माफ करा, उत्तर देण्यात अडचण आली. पुन्हा प्रयत्न करा.",
            "hi": "क्षमा करें, उत्तर देने में समस्या हुई। पुनः प्रयास करें।",
            "en": "Sorry, there was an error generating a response. Please try again.",
        }
        return {"answer": fallback.get(language, fallback["en"]), "sources": []}