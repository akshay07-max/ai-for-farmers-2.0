// ================================================================
// HEALTH LOG MODEL
// Every health reading — manual OR from IoT SmartTag — stored here.
// Same schema, source field tells us where it came from.
// ================================================================
const mongoose = require("mongoose");

const healthLogSchema = new mongoose.Schema(
  {
    cattleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cattle",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Vitals ────────────────────────────────────────────────
    temperature: { type: Number }, // °C  (normal: 38.0–39.5)
    heartRate: { type: Number }, // bpm (normal: 60–80)
    activityScore: { type: Number }, // 0–100 from accelerometer
    weight: { type: Number }, // kg

    // ── Milk production ───────────────────────────────────────
    milkMorning: { type: Number }, // litres
    milkEvening: { type: Number }, // litres
    milkTotal: { type: Number }, // auto-calculated

    // ── Behavioral observations ───────────────────────────────
    appetite: { type: String, enum: ["NORMAL", "REDUCED", "NOT_EATING"] },
    activity: {
      type: String,
      enum: ["ACTIVE", "NORMAL", "LETHARGIC", "RESTLESS"],
    },
    rumination: { type: String, enum: ["NORMAL", "REDUCED", "ABSENT"] },

    // ── Symptoms (multi-select) ───────────────────────────────
    symptoms: [
      {
        type: String,
        enum: [
          "COUGH",
          "NASAL_DISCHARGE",
          "EYE_DISCHARGE",
          "DIARRHEA",
          "BLOATING",
          "LAMENESS",
          "SKIN_LESIONS",
          "UDDER_SWELLING",
          "REDUCED_MILK",
          "FEVER",
          "LOSS_OF_APPETITE",
          "LETHARGY",
          "ABNORMAL_BREATHING",
          "SWOLLEN_JOINTS",
          "MOUTH_LESIONS",
        ],
      },
    ],

    // ── Computed anomaly result ───────────────────────────────
    anomaly: {
      detected: { type: Boolean, default: false },
      riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      flags: [String], // ["High temperature", "Milk drop >20%"]
      suggestion: { type: String }, // likely disease or action
    },

    // ── GPS (from IoT device) ─────────────────────────────────
    location: {
      lat: Number,
      lon: Number,
    },

    // ── Source ────────────────────────────────────────────────
    source: { type: String, enum: ["MANUAL", "IOT"], default: "MANUAL" },
    deviceId: { type: String }, // populated if source=IOT

    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Auto-calculate milkTotal before saving
healthLogSchema.pre("save", async function () {
  if (this.milkMorning != null || this.milkEvening != null) {
    this.milkTotal = (this.milkMorning || 0) + (this.milkEvening || 0);
  }
});

healthLogSchema.index({ cattleId: 1, recordedAt: -1 });
healthLogSchema.index({ ownerId: 1, recordedAt: -1 });

// Auto-delete logs older than 2 years
healthLogSchema.index(
  { recordedAt: 1 },
  { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 },
);

module.exports = mongoose.model("HealthLog", healthLogSchema);
