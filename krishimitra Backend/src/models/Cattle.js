// ================================================================
// CATTLE MODEL
// Stores each animal's profile, health baseline, and device info.
// Supports both manual entry AND IoT hardware (SmartTag).
// ================================================================
const mongoose = require("mongoose");

const cattleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Basic identity ────────────────────────────────────────
    name: { type: String, required: true, trim: true }, // "Lakshmi"
    tagNumber: { type: String, trim: true }, // govt ear tag: "MH-NAS-001"
    species: {
      type: String,
      enum: ["COW", "BUFFALO", "GOAT", "SHEEP", "OX"],
      default: "COW",
    },
    breed: { type: String, trim: true }, // "HF", "Gir", "Murrah", "Sahiwal"
    gender: { type: String, enum: ["FEMALE", "MALE"], required: true },
    dateOfBirth: { type: Date },
    color: { type: String, trim: true },
    photo: { type: String }, // S3 URL

    // ── Health baseline ───────────────────────────────────────
    // Calculated from first 14 days of readings — used for anomaly detection
    baseline: {
      avgTemperature: { type: Number }, // e.g. 38.5
      avgMilkYield: { type: Number }, // litres/day
      avgActivityScore: { type: Number }, // 0-100
      calculatedAt: { type: Date },
      sampleCount: { type: Number, default: 0 },
    },

    // ── Reproduction ──────────────────────────────────────────
    isPregnant: { type: Boolean, default: false },
    pregnancyDate: { type: Date }, // date of conception
    expectedCalving: { type: Date }, // auto-calc: pregnancyDate + 280 days
    lastCalvingDate: { type: Date },
    calvingCount: { type: Number, default: 0 },
    lastHeatDate: { type: Date }, // last estrus date
    nextHeatDate: { type: Date }, // predicted next: lastHeatDate + 21 days

    // ── Lactation ─────────────────────────────────────────────
    isLactating: { type: Boolean, default: false },
    lactationStart: { type: Date },
    lactationNumber: { type: Number, default: 0 }, // which lactation period

    // ── IoT Hardware ──────────────────────────────────────────
    // When you build your SmartTag, register it here
    iotDevice: {
      deviceId: { type: String }, // "TAG-001" — printed on device
      deviceToken: { type: String }, // hashed auth token for API calls
      isActive: { type: Boolean, default: false },
      lastSeenAt: { type: Date },
      batteryLevel: { type: Number }, // 0-100%
      firmwareVersion: { type: String },
    },

    // ── Status ────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true },
);

// Virtual: age in months
cattleSchema.virtual("ageMonths").get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - this.dateOfBirth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
});

cattleSchema.index({ ownerId: 1, isActive: 1 });
cattleSchema.index({ "iotDevice.deviceToken": 1 });

module.exports = mongoose.model("Cattle", cattleSchema);
