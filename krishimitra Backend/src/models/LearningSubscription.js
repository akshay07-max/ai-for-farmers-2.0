// ================================================================
// LEARNING SUBSCRIPTION MODEL
// Completely independent from the main app Subscription model.
// A farmer can have any combination of main + learning plans.
// ================================================================
const mongoose = require("mongoose");

const LEARNING_PLANS = {
  LEARNING_FREE: {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    courseLimit: 0, // can view catalogue but not enroll
    sessionLimit: 3, // 3 live Sheti Mitra sessions/month
    features: ["catalogue_view", "limited_sessions"],
  },
  LEARNING_BASIC: {
    name: "Basic",
    price: { monthly: 9900, yearly: 99900 }, // paise
    courseLimit: 2, // enroll in 2 courses simultaneously
    sessionLimit: 20,
    features: [
      "catalogue_view",
      "enroll_courses",
      "quiz",
      "assignments",
      "audio_lessons",
      "syllabus_builder",
      "limited_sessions",
    ],
  },
  LEARNING_PRO: {
    name: "Pro",
    price: { monthly: 19900, yearly: 199900 },
    courseLimit: -1, // unlimited
    sessionLimit: -1, // unlimited
    features: [
      "catalogue_view",
      "enroll_courses",
      "quiz",
      "assignments",
      "audio_lessons",
      "syllabus_builder",
      "unlimited_sessions",
      "certificates",
      "priority_support",
    ],
  },
};

const learningSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one learning subscription per user
      index: true,
    },

    plan: {
      type: String,
      enum: Object.keys(LEARNING_PLANS),
      default: "LEARNING_FREE",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED", "PENDING_PAYMENT"],
      default: "ACTIVE",
    },
    billing: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
    },

    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }, // null for FREE plan

    // Razorpay references (independent of main app payments)
    razorpay: {
      orderId: String,
      paymentId: String,
      signature: String,
    },

    // Usage tracking (resets monthly)
    usage: {
      sessionsThisMonth: { type: Number, default: 0 },
      usageResetAt: { type: Date, default: Date.now },
    },

    payments: [
      {
        razorpayPaymentId: String,
        amount: Number,
        plan: String,
        billing: String,
        paidAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Check if a feature is available on this plan
learningSubscriptionSchema.methods.hasFeature = function (feature) {
  if (this.status !== "ACTIVE") return false;
  if (this.endDate && this.endDate < new Date()) return false;
  return LEARNING_PLANS[this.plan]?.features?.includes(feature) || false;
};

// Check if session limit is reached
learningSubscriptionSchema.methods.canStartSession = function () {
  const limit = LEARNING_PLANS[this.plan]?.sessionLimit;
  if (limit === -1) return true; // unlimited
  // Reset monthly counter if needed
  const now = new Date();
  const resetAt = new Date(this.usage.usageResetAt);
  if (
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
    this.usage.sessionsThisMonth = 0;
    this.usage.usageResetAt = now;
  }
  return this.usage.sessionsThisMonth < limit;
};

module.exports = mongoose.model(
  "LearningSubscription",
  learningSubscriptionSchema,
);
module.exports.LEARNING_PLANS = LEARNING_PLANS;
