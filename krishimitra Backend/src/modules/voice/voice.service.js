// ================================================================
// VOICE SERVICE
// Orchestrates the full voice query pipeline:
// 1. Receive audio from farmer's phone
// 2. Send to Python /stt → get transcript
// 3. Send transcript to Python /chat → get AI answer
// 4. Send answer to Python /tts → get audio response
// 5. Upload both audio files to S3
// 6. Save full exchange to MongoDB ChatSession
// 7. Return transcript + answer + audio URL to the app
// ================================================================
const axios       = require("axios");
const FormData    = require("form-data");
const { v4: uuidv4 } = require("uuid");
const ChatSession = require("../../models/ChatSession");
const User        = require("../../models/User");
const { uploadToS3 } = require("../../config/s3");
const { AppError }   = require("../../middlewares/errorHandler");
const logger         = require("../../utils/logger");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8500";
const AI_TIMEOUT_MS  = 60000; // 60 seconds — Whisper can be slow on CPU

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Call Python STT service — audio bytes → transcript
 */
const callSTT = async (audioBuffer, filename, language) => {
  const form = new FormData();
  form.append("audio", audioBuffer, {
    filename:    filename || "audio.mp3",
    contentType: "audio/mpeg",
  });
  if (language) form.append("language", language);

  const response = await axios.post(`${AI_SERVICE_URL}/stt`, form, {
    headers: { ...form.getHeaders() },
    timeout: AI_TIMEOUT_MS,
  });
  return response.data; // { transcript, language_detected, confidence }
};

/**
 * Call Python Chat service — text → AI answer
 */
const callChat = async (message, history, language, userContext) => {
  const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
    message,
    userId:   "node-caller",
    language,
    history,
    context:  userContext,
  }, { timeout: AI_TIMEOUT_MS });
  return response.data; // { answer, language, sources }
};

/**
 * Call Python TTS service — text → MP3 audio buffer
 */
const callTTS = async (text, language) => {
  const response = await axios.post(`${AI_SERVICE_URL}/tts`, {
    text,
    language,
  }, {
    timeout:      AI_TIMEOUT_MS,
    responseType: "arraybuffer", // important — we want raw bytes not JSON
  });
  return Buffer.from(response.data);
};

// ── Main service functions ────────────────────────────────────────────────────

/**
 * processVoiceQuery — full pipeline for a voice message
 *
 * @param {string}   userId      — logged-in farmer's ID
 * @param {Buffer}   audioBuffer — raw audio bytes from the app
 * @param {string}   filename    — original filename from upload
 * @param {string}   sessionId   — existing session ID (null = new session)
 * @param {string}   language    — "mr"|"hi"|"en"
 */
const processVoiceQuery = async (userId, audioBuffer, filename, sessionId, language) => {
  const startTime = Date.now();

  // ── Load user for context ──────────────────────────────────
  const user = await User.findById(userId).select(
    "name district primaryCrops farmSizeAcres languagePreference"
  );
  const lang = language || user?.languagePreference || "mr";

  const userContext = {
    district:     user?.district,
    primaryCrops: user?.primaryCrops || [],
    farmSize:     user?.farmSizeAcres,
  };

  // ── Load or create chat session ────────────────────────────
  let session;
  if (sessionId) {
    session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) throw new AppError("Chat session not found.", 404, "ERR_CHAT_001");
  } else {
    session = await ChatSession.create({
      userId,
      channel:  "VOICE",
      language: lang,
      title:    "Voice Conversation",
    });
  }

  // Build history from last 10 messages (keeps context without token overflow)
  const recentHistory = session.messages.slice(-10).map((m) => ({
    role:    m.role,
    content: m.content,
  }));

  // ── Step 1: STT — transcribe audio ────────────────────────
  logger.info(`[Voice] STT started for user ${userId}`);
  let sttResult;
  try {
    sttResult = await callSTT(audioBuffer, filename, lang);
  } catch (err) {
    throw new AppError(
      `Speech recognition failed: ${err.response?.data?.detail || err.message}`,
      502, "ERR_VOICE_001"
    );
  }

  const transcript = sttResult.transcript;
  if (!transcript || transcript.trim().length === 0) {
    throw new AppError(
      "Could not understand the audio. Please speak clearly and try again.",
      400, "ERR_VOICE_002"
    );
  }

  logger.info(`[Voice] Transcript: "${transcript.substring(0, 60)}..."`);

  // ── Step 2: Upload input audio to S3 ──────────────────────
  const inputAudioKey = `voice/input/${userId}/${uuidv4()}.mp3`;
  const inputAudioUrl = await uploadToS3(audioBuffer, inputAudioKey) || null;

  // ── Step 3: Chat — get AI answer ──────────────────────────
  logger.info(`[Voice] Calling AI chat service...`);
  let chatResult;
  try {
    chatResult = await callChat(transcript, recentHistory, lang, userContext);
  } catch (err) {
    throw new AppError(
      `AI response failed: ${err.response?.data?.detail || err.message}`,
      502, "ERR_VOICE_003"
    );
  }

  const answer = chatResult.answer;
  logger.info(`[Voice] Answer: "${answer.substring(0, 60)}..."`);

  // ── Step 4: TTS — convert answer to audio ─────────────────
  logger.info(`[Voice] Generating audio response...`);
  let responseAudioBuffer;
  let responseAudioUrl = null;
  let responseAudioBase64 = null;

  try {
    responseAudioBuffer = await callTTS(answer, lang);

    // Try S3 first, fall back to base64 for dev
    const responseAudioKey = `voice/response/${userId}/${uuidv4()}.mp3`;
    responseAudioUrl = await uploadToS3(responseAudioBuffer, responseAudioKey);

    if (!responseAudioUrl) {
      // Dev mode — return base64 so app can play it directly
      responseAudioBase64 = responseAudioBuffer.toString("base64");
    }
  } catch (err) {
    // TTS failure is non-fatal — farmer still gets text answer
    logger.warn(`[Voice] TTS failed: ${err.message} — returning text only`);
  }

  const latencyMs = Date.now() - startTime;

  // ── Step 5: Save to chat session ──────────────────────────
  session.messages.push(
    {
      role:             "user",
      content:          transcript,
      audioUrl:         inputAudioUrl,
    },
    {
      role:              "model",
      content:           answer,
      responseAudioUrl:  responseAudioUrl,
      sources:           chatResult.sources || [],
      latencyMs,
    }
  );
  session.messageCount  = session.messages.length;
  session.lastMessageAt = new Date();
  if (session.messageCount === 2) {
    // Auto-title from first message
    session.title = transcript.substring(0, 50);
  }
  await session.save();

  logger.info(`[Voice] Complete in ${latencyMs}ms | session ${session._id}`);

  return {
    sessionId:         session._id,
    transcript,
    languageDetected:  sttResult.language_detected,
    answer,
    sources:           chatResult.sources || [],
    responseAudioUrl,
    responseAudioBase64,  // null if S3 is configured, base64 string if not
    latencyMs,
  };
};

module.exports = { processVoiceQuery, callChat, callSTT, callTTS };