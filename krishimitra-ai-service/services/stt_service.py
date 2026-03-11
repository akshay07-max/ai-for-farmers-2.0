# Whisper speech-to-text (Marathi/Hindi/English)

# ================================================================
# STT SERVICE — Speech to Text using OpenAI Whisper
#
# Whisper is a free, local model — no API key needed, no per-call cost.
# It runs on your CPU (slow but works) or GPU (fast).
# Model sizes: tiny/base/small/medium/large
# We use "small" — good balance of speed and accuracy for Indian languages.
# "large" is more accurate but needs 10GB RAM.
# ================================================================
import io
import os
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Whisper is loaded lazily — only when first STT call is made.
# Loading takes ~10 seconds for "small" model.
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        model_size = os.getenv("WHISPER_MODEL_SIZE", "small")
        logger.info(f"Loading Whisper '{model_size}' model — takes ~10 seconds...")
        _whisper_model = whisper.load_model(model_size)
        logger.info(f"Whisper '{model_size}' model loaded")
    return _whisper_model


async def transcribe_audio(audio_bytes: bytes, filename: str, language_hint: str = None) -> dict:
    """
    Transcribe audio bytes to text using Whisper.

    Args:
        audio_bytes:   Raw audio file bytes (mp3, wav, m4a, ogg, webm)
        filename:      Original filename — used to determine format
        language_hint: "mr", "hi", "en" — hint for better accuracy.
                       If None, Whisper auto-detects the language.

    Returns:
        { transcript, language_detected, confidence }
    """
    # Map our language codes to Whisper's language codes
    LANG_MAP = {
        "mr": "marathi",
        "hi": "hindi",
        "en": "english",
    }

    whisper_lang = LANG_MAP.get(language_hint) if language_hint else None

    # Write audio bytes to a temp file — Whisper needs a file path
    suffix = Path(filename).suffix or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        model = get_whisper_model()

        # Transcribe
        # language=None means auto-detect (Whisper is very good at this)
        result = model.transcribe(
            tmp_path,
            language=whisper_lang,
            task="transcribe",
            fp16=False,              # set True if you have a GPU
            verbose=False,
        )

        transcript        = result["text"].strip()
        language_detected = result.get("language", language_hint or "unknown")
        # Whisper doesn't give a direct confidence score — we calculate
        # from the average log probability of the segments
        segments = result.get("segments", [])
        if segments:
            avg_logprob = sum(s.get("avg_logprob", -1) for s in segments) / len(segments)
            # Convert log probability to 0-1 confidence (rough approximation)
            confidence = max(0.0, min(1.0, (avg_logprob + 1.0)))
        else:
            confidence = 0.5

        logger.info(f"STT: '{transcript[:50]}...' | lang={language_detected} | conf={confidence:.2f}")

        return {
            "transcript":        transcript,
            "language_detected": language_detected,
            "confidence":        round(confidence, 2),
        }

    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise RuntimeError(f"Transcription failed: {str(e)}")

    finally:
        # Always clean up the temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass