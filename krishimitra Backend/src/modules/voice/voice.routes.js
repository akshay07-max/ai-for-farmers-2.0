// ================================================================
// VOICE ROUTES
// ================================================================
const express    = require("express");
const router     = express.Router();
const multer     = require("multer");
const { protect }= require("../../middlewares/auth");
const controller = require("./voice.controller");

// Multer config — store audio in memory (not disk)
// Max 10MB — plenty for a 30-second voice clip
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
                     "audio/ogg", "audio/webm", "audio/m4a", "audio/x-m4a",
                     "audio/mp4", "application/octet-stream"];
    // Be lenient — React Native sometimes sends wrong MIME type
    cb(null, true);
  },
});

/**
 * POST /api/v1/voice/query
 * Full voice pipeline: audio → STT → Gemini+RAG → TTS → response
 */
router.post(
  "/query",
  protect,
  upload.single("audio"),
  controller.voiceQuery
);

module.exports = router;