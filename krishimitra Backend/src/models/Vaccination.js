// ================================================================
// VACCINATION MODEL
// Tracks vaccination history and upcoming due dates.
// Cron job checks daily and sends reminders 7 days before due.
// ================================================================
const mongoose = require("mongoose");

const vaccinationSchema = new mongoose.Schema(
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

    vaccineName: { type: String, required: true, trim: true },
    disease: { type: String, trim: true }, // "FMD", "BQ", "HS"
    givenDate: { type: Date, required: true },
    givenBy: { type: String, trim: true }, // vet name or "self"
    batchNumber: { type: String, trim: true },
    dose: { type: String, trim: true }, // "5ml"
    nextDueDate: { type: Date },
    notes: { type: String },

    // Reminder state
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Standard Indian cattle vaccination schedule
// Used by the frontend to suggest vaccine names and intervals
vaccinationSchema.statics.SCHEDULE = {
  FMD: {
    name: "FMD Vaccine (Foot & Mouth Disease)",
    nameMr: "पाय-तोंड रोग लस",
    intervalDays: 180, // every 6 months
    disease: "Foot and Mouth Disease",
  },
  HS: {
    name: "HS Vaccine (Hemorrhagic Septicemia)",
    nameMr: "घटसर्प लस",
    intervalDays: 365, // annual
    disease: "Hemorrhagic Septicemia",
  },
  BQ: {
    name: "BQ Vaccine (Black Quarter)",
    nameMr: "फऱ्या रोग लस",
    intervalDays: 365,
    disease: "Black Quarter",
  },
  BRUCELLOSIS: {
    name: "Brucellosis Vaccine",
    nameMr: "ब्रुसेलोसिस लस",
    intervalDays: null, // once in lifetime for female calves
    disease: "Brucellosis",
  },
  THEILERIA: {
    name: "Theileria Vaccine",
    nameMr: "थायलेरिया लस",
    intervalDays: 365,
    disease: "Theileria (Tick Fever)",
  },
  ANTHRAX: {
    name: "Anthrax Vaccine",
    nameMr: "अँथ्रॅक्स लस",
    intervalDays: 365,
    disease: "Anthrax",
  },
};

vaccinationSchema.index({ cattleId: 1, givenDate: -1 });
vaccinationSchema.index({ nextDueDate: 1, reminderSent: 1 }); // for cron job

module.exports = mongoose.model("Vaccination", vaccinationSchema);
