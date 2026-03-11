// ================================================================
// VOICE CONTROLLER
// ================================================================
const voiceService               = require("./voice.service");
const { sendSuccess, sendError } = require("../../utils/response");

/**
 * POST /api/v1/voice/query
 * Farmer sends audio → gets transcript + text answer + audio answer back.
 *
 * Body: multipart/form-data
 *   audio:     <audio file>   (required)
 *   sessionId: string         (optional — omit to start new session)
 *   language:  "mr"|"hi"|"en" (optional — defaults to user's preference)
 */
async function voiceQuery(req, res, next) {
  try {
    if (!req.file) {
      return sendError(res, 400,
        "Audio file is required. Send as multipart/form-data with key 'audio'.",
        "ERR_VAL_001"
      );
    }

    const { sessionId, language } = req.body;

    const result = await voiceService.processVoiceQuery(
      req.user._id,
      req.file.buffer,
      req.file.originalname,
      sessionId || null,
      language  || null,
    );

    sendSuccess(res, 200, "Voice query processed successfully.", { voice: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { voiceQuery };