// ================================================================
// CHAT SERVICE — Text chat with full conversation history
// ================================================================
const ChatSession    = require("../../models/ChatSession");
const User           = require("../../models/User");
const { callChat }   = require("../voice/voice.service");
const { AppError }   = require("../../middlewares/errorHandler");
const logger         = require("../../utils/logger");

/**
 * sendMessage — send a text message and get an AI response
 *
 * @param {string} userId    — logged-in farmer's ID
 * @param {string} message   — the farmer's text message
 * @param {string} sessionId — existing session (null = new session)
 * @param {string} language  — "mr"|"hi"|"en"
 */
const sendMessage = async (userId, message, sessionId, language) => {
  const startTime = Date.now();

  // ── Load user for context ──────────────────────────────────
  const user = await User.findById(userId).select(
    "district primaryCrops farmSizeAcres languagePreference"
  );
  const lang = language || user?.languagePreference || "mr";

  const userContext = {
    district:     user?.district,
    primaryCrops: user?.primaryCrops || [],
    farmSize:     user?.farmSizeAcres,
  };

  // ── Load or create session ─────────────────────────────────
  let session;
  if (sessionId) {
    session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) throw new AppError("Chat session not found.", 404, "ERR_CHAT_001");
  } else {
    session = await ChatSession.create({
      userId,
      channel:  "TEXT",
      language: lang,
      title:    message.substring(0, 50),
    });
  }

  // Last 10 messages as history context
  const recentHistory = session.messages.slice(-10).map((m) => ({
    role:    m.role,
    content: m.content,
  }));

  // ── Call Python AI service ─────────────────────────────────
  let chatResult;
  try {
    chatResult = await callChat(message, recentHistory, lang, userContext);
  } catch (err) {
    throw new AppError(
      `AI service error: ${err.response?.data?.detail || err.message}`,
      502, "ERR_CHAT_002"
    );
  }

  const latencyMs = Date.now() - startTime;

  // ── Save messages to session ───────────────────────────────
  session.messages.push(
    { role: "user",  content: message },
    { role: "model", content: chatResult.answer, sources: chatResult.sources || [], latencyMs }
  );
  session.messageCount  = session.messages.length;
  session.lastMessageAt = new Date();
  await session.save();

  logger.info(`[Chat] user=${userId} | session=${session._id} | ${latencyMs}ms`);

  return {
    sessionId: session._id,
    message:   chatResult.answer,
    sources:   chatResult.sources || [],
    language:  lang,
    latencyMs,
  };
};

/**
 * getSessions — list a user's chat sessions (for history screen)
 */
const getSessions = async (userId, page = 1, limit = 20) => {
  const sessions = await ChatSession.find({ userId, isActive: true })
    .sort({ lastMessageAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("title channel language messageCount lastMessageAt createdAt");

  const total = await ChatSession.countDocuments({ userId, isActive: true });

  return {
    sessions,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * getSession — get full message history for one session
 */
const getSession = async (userId, sessionId) => {
  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) throw new AppError("Session not found.", 404, "ERR_CHAT_001");
  return session;
};

/**
 * deleteSession — soft delete (marks inactive)
 */
const deleteSession = async (userId, sessionId) => {
  const session = await ChatSession.findOneAndUpdate(
    { _id: sessionId, userId },
    { isActive: false },
    { new: true }
  );
  if (!session) throw new AppError("Session not found.", 404, "ERR_CHAT_001");
  return { deleted: true };
};

module.exports = { sendMessage, getSessions, getSession, deleteSession };