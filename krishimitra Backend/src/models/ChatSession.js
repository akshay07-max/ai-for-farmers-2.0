// ================================================================
// CHAT SESSION MODEL
// Stores full conversation history per user.
// Node.js manages history here — Python AI service is stateless.
// ================================================================
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ["user", "model"], required: true },
    content: { type: String, required: true },
    // For voice messages — links to the audio files
    audioUrl:       { type: String },  // farmer's voice input (S3 URL)
    responseAudioUrl:{ type: String }, // AI's spoken response (S3 URL)
    // Which RAG documents were used to generate this answer
    sources: [{ type: String }],
    // How long Gemini took to respond (for monitoring)
    latencyMs: { type: Number },
  },
  { timestamps: true }
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // Conversation title — auto-generated from first message
    title:    { type: String, default: "New Conversation" },

    // Input channel for this session
    channel:  { type: String, enum: ["TEXT", "VOICE"], default: "TEXT" },

    // Language used in this session
    language: { type: String, enum: ["mr", "hi", "en"], default: "mr" },

    // All messages in this conversation
    messages: [messageSchema],

    // Quick stats
    messageCount: { type: Number, default: 0 },
    lastMessageAt:{ type: Date },

    // Is this session still active or archived?
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Fast lookup for user's chat history
chatSessionSchema.index({ userId: 1, lastMessageAt: -1 });

// Auto-delete sessions older than 90 days
chatSessionSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

module.exports = mongoose.model("ChatSession", chatSessionSchema);