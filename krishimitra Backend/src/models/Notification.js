// ================================================================
// NOTIFICATION MODEL
// Every notification sent (push OR SMS) is logged here.
// Gives us: delivery tracking, resend on failure, user notification history.
// ================================================================
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Which module triggered this notification
    module: {
      type: String,
      enum: [
        "AUTH",
        "MARKET",
        "WEATHER",
        "CATTLE",
        "LEARNING",
        "PAYMENT",
        "ADMIN",
      ],
      required: true,
    },

    // Type of notification event
    type: {
      type: String,
      enum: [
        "OTP",
        "PRICE_ALERT",
        "PRICE_DROP",
        "PRICE_RISE",
        "WEATHER_RISK",
        "WEATHER_ALERT",
        "CATTLE_HEALTH_ALERT",
        "CATTLE_VACCINATION_DUE",
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "SUBSCRIPTION_EXPIRING",
        "SUBSCRIPTION_EXPIRED",
        "LEARNING_REMINDER",
        "BROADCAST",
        "GENERAL",
      ],
      required: true,
    },

    // Notification content
    title: { type: String, required: true }, // push title / SMS header
    body: { type: String, required: true }, // push body / SMS text
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // extra payload for deep linking

    // Which channels were used
    channels: {
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },

    // Delivery status per channel
    status: {
      push: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED", "SKIPPED"],
        default: "PENDING",
      },
      sms: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED", "SKIPPED"],
        default: "PENDING",
      },
    },

    // Has the user read/seen this notification in the app?
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    // Retry tracking (for failed deliveries)
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { timestamps: true },
);

// Auto-delete notifications older than 90 days to save storage
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

// Fast lookup for user's notification feed
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
