// ================================================================
// CHAT ROUTES
// ================================================================
const express    = require("express");
const router     = express.Router();
const { protect }= require("../../middlewares/auth");
const controller = require("./chat.controller");

// POST /api/v1/chat/message — send a message, get AI reply
router.post("/message",  protect, controller.sendMessage);

// GET  /api/v1/chat/sessions — list all sessions
router.get("/sessions",  protect, controller.getSessions);

// GET  /api/v1/chat/sessions/:sessionId — get one session with full history
router.get("/sessions/:sessionId",    protect, controller.getSession);

// DELETE /api/v1/chat/sessions/:sessionId — delete a session
router.delete("/sessions/:sessionId", protect, controller.deleteSession);

module.exports = router;