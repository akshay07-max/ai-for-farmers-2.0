// ================================================================
// TUTOR SESSION MODEL — live Sheti Mitra teaching conversation
// ================================================================
const mongoose = require("mongoose");

const tutorSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    lessonId: { type: mongoose.Schema.Types.ObjectId },

    language: { type: String, enum: ["mr", "hi", "en"], default: "mr" },

    // Teaching progression
    stage: {
      type: String,
      enum: ["INTRO", "TEACHING", "CHECKING", "SUMMARY", "DONE"],
      default: "INTRO",
    },

    // Full conversation history
    messages: [
      {
        role: { type: String, enum: ["tutor", "farmer"], required: true },
        content: { type: String, required: true },
        audioUrl: String, // TTS URL for tutor messages
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // Teaching state — tracks where Gemini is in the lesson
    teachingState: {
      chunkIndex: { type: Number, default: 0 }, // which part of lesson
      totalChunks: { type: Number, default: 0 },
      checkingQuestion: String, // current comprehension question
      waitingForAnswer: { type: Boolean, default: false },
    },

    // Session outcome
    completed: { type: Boolean, default: false },
    completedAt: Date,
    durationMinutes: { type: Number, default: 0 },
    farmerRating: { type: Number, min: 1, max: 5 },
    farmerFeedback: String,
  },
  { timestamps: true },
);

// Auto-delete sessions older than 60 days
tutorSessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 },
);

module.exports = mongoose.model("TutorSession", tutorSessionSchema);
