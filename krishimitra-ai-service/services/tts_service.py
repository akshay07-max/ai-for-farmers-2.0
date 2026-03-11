# Text-to-speech (gTTS — free, works in all 3 languages)


# ================================================================
# TTS SERVICE — Text to Speech using gTTS
#
# gTTS (Google Text-to-Speech) is free, requires no API key,
# and supports Marathi, Hindi, and English natively.
# It returns an MP3 file as bytes.
# ================================================================
import io
import logging
import asyncio
from functools import partial

logger = logging.getLogger(__name__)

# gTTS language codes
LANG_CODES = {
    "mr": "mr",   # Marathi
    "hi": "hi",   # Hindi
    "en": "en",   # English
}


async def synthesize(text: str, language: str = "mr") -> bytes:
    """
    Convert text to speech audio (MP3 bytes).

    Args:
        text:     The text to speak (max ~1000 characters for clean output)
        language: "mr" | "hi" | "en"

    Returns:
        MP3 audio as bytes — send directly as audio file response
    """
    from gtts import gTTS

    lang_code = LANG_CODES.get(language, "mr")

    # Clean the text — remove markdown formatting that sounds weird when spoken
    text = text.replace("**", "").replace("*", "").replace("#", "")
    text = text.replace("```", "").replace("`", "")
    # Trim to reasonable length for audio
    if len(text) > 1000:
        text = text[:997] + "..."

    logger.info(f"TTS: lang={lang_code} | text_len={len(text)}")

    # gTTS is blocking (not async) — run in thread pool so we don't block FastAPI
    loop = asyncio.get_event_loop()

    def _synthesize_sync():
        tts    = gTTS(text=text, lang=lang_code, slow=False)
        buffer = io.BytesIO()
        tts.write_to_fp(buffer)
        buffer.seek(0)
        return buffer.read()

    try:
        audio_bytes = await loop.run_in_executor(None, _synthesize_sync)
        logger.info(f"TTS complete: {len(audio_bytes)} bytes")
        return audio_bytes
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise RuntimeError(f"Text-to-speech failed: {str(e)}")