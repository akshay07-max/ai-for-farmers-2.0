// ================================================================
// COURSE MODEL
// Admin creates the skeleton. Gemini fills content on first request.
// Content is cached per language — never regenerated unless forced.
// ================================================================
const mongoose = require("mongoose");

// ── Quiz question schema ──────────────────────────────────────
const quizQuestionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["MCQ", "OPEN"], required: true },
    question: { type: String, required: true },
    questionMr: { type: String },
    questionHi: { type: String },
    // MCQ fields
    options: [String], // 4 options
    optionsMr: [String],
    optionsHi: [String],
    correct: Number, // index of correct option (MCQ only)
    // Open-ended evaluation hint (for Gemini to evaluate)
    evaluationCriteria: String,
    explanation: String,
    explanationMr: String,
    explanationHi: String,
  },
  { _id: false },
);

// ── Lesson schema ─────────────────────────────────────────────
const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    titleMr: { type: String },
    titleHi: { type: String },

    sequence: { type: Number, required: true },

    type: {
      type: String,
      enum: ["THEORY", "PRACTICAL", "QUIZ", "LIVE_SESSION"],
      default: "THEORY",
    },

    // What we tell Gemini to teach — admin writes this
    // Example: "Teach about soil pH testing for onion farming in Maharashtra.
    //           Include: what pH is, ideal range for onion (6.0-7.0),
    //           how to test at home with a kit, how to correct with lime."
    aiPrompt: { type: String, required: true },

    // Cached AI-generated content — populated on first request, per language
    generatedContent: {
      en: { type: String },
      mr: { type: String },
      hi: { type: String },
      generatedAt: Date,
    },

    // Cached TTS audio URLs (S3) — populated after content generation
    audioUrls: {
      en: String,
      mr: String,
      hi: String,
    },

    // AI-generated quiz — populated on first quiz request
    quiz: {
      questions: [quizQuestionSchema],
      generatedAt: Date,
    },

    // Practical assignment
    assignment: {
      task: String, // "Go to your field and collect soil from 3 spots..."
      taskMr: String,
      taskHi: String,
    },

    estimatedMinutes: { type: Number, default: 15 },
    isPublished: { type: Boolean, default: true },
  },
  { _id: true },
);

// ── Module schema ─────────────────────────────────────────────
const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    titleMr: { type: String },
    titleHi: { type: String },
    sequence: { type: Number, required: true },
    lessons: [lessonSchema],
    estimatedMinutes: { type: Number, default: 60 },
  },
  { _id: true },
);

// ── Course schema ─────────────────────────────────────────────
const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    titleMr: { type: String },
    titleHi: { type: String },
    description: { type: String },
    descriptionMr: { type: String },
    descriptionHi: { type: String },

    category: {
      type: String,
      enum: [
        "CROP_MANAGEMENT",
        "IRRIGATION",
        "SOIL_HEALTH",
        "PEST_MANAGEMENT",
        "CATTLE",
        "ORGANIC_FARMING",
        "GOVT_SCHEMES",
        "MARKET",
        "GENERAL",
      ],
      required: true,
    },

    targetCrops: [String], // ["onion", "wheat"] — empty means all crops
    targetAudience: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "EXPERT", "ALL"],
      default: "ALL",
    },

    difficulty: {
      type: String,
      enum: ["EASY", "MEDIUM", "HARD"],
      default: "EASY",
    },
    estimatedHours: { type: Number },
    thumbnail: { type: String }, // S3 URL
    modules: [moduleSchema],

    // Who created this course
    createdBy: { type: String, enum: ["AI", "ADMIN"], default: "ADMIN" },
    isPublished: { type: Boolean, default: false },

    // Stats
    enrollmentCount: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

courseSchema.index({ category: 1, isPublished: 1 });
courseSchema.index({ targetCrops: 1 });

module.exports = mongoose.model("Course", courseSchema);
