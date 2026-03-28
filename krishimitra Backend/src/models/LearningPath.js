// ================================================================
// LEARNING PATH MODEL — per farmer per course progress
// ================================================================
const mongoose = require("mongoose");

const learningPathSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    status: {
      type: String,
      enum: ["ENROLLED", "IN_PROGRESS", "COMPLETED", "DROPPED"],
      default: "ENROLLED",
    },

    // Current position in the course
    currentModuleId: mongoose.Schema.Types.ObjectId,
    currentLessonId: mongoose.Schema.Types.ObjectId,

    // Completed lesson IDs
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId }],

    // Quiz scores per lesson
    quizScores: [
      {
        lessonId: mongoose.Schema.Types.ObjectId,
        score: Number, // 0-100
        attempts: { type: Number, default: 1 },
        passed: Boolean,
        completedAt: Date,
      },
    ],

    // Completed assignment lesson IDs
    completedAssignments: [{ type: mongoose.Schema.Types.ObjectId }],

    // Engagement stats
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastStudiedAt: { type: Date },
    totalMinutesSpent: { type: Number, default: 0 },
    sessionsCount: { type: Number, default: 0 },

    // Completion
    completedAt: { type: Date },
    certificate: {
      issuedAt: Date,
      url: String, // S3 URL — generated in Step 11
    },

    // Rating given by farmer
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },

    // Language farmer is studying this course in
    language: { type: String, enum: ["mr", "hi", "en"], default: "mr" },
  },
  { timestamps: true },
);

learningPathSchema.index({ userId: 1, courseId: 1 }, { unique: true });
learningPathSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("LearningPath", learningPathSchema);
