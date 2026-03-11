// ================================================================
// CHAT CONTROLLER
// ================================================================
const chatService                = require("./chat.service");
const { sendSuccess, sendError } = require("../../utils/response");

async function sendMessage(req, res, next) {
  try {
    const { message, sessionId, language } = req.body;

    if (!message || !message.trim()) {
      return sendError(res, 400, "Message is required.", "ERR_VAL_001");
    }
    if (message.trim().length > 2000) {
      return sendError(res, 400, "Message too long (max 2000 characters).", "ERR_VAL_002");
    }

    const result = await chatService.sendMessage(
      req.user._id,
      message.trim(),
      sessionId || null,
      language  || null,
    );

    sendSuccess(res, 200, "Message sent successfully.", { chat: result });
  } catch (err) {
    next(err);
  }
}

async function getSessions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await chatService.getSessions(req.user._id, parseInt(page), parseInt(limit));
    sendSuccess(res, 200, "Chat sessions fetched.", result);
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await chatService.getSession(req.user._id, req.params.sessionId);
    sendSuccess(res, 200, "Session fetched.", { session });
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    await chatService.deleteSession(req.user._id, req.params.sessionId);
    sendSuccess(res, 200, "Session deleted.", null);
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, getSessions, getSession, deleteSession };