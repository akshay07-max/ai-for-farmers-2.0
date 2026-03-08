// ================================================================
// WEATHER LOG MODEL
// Stores every weather fetch so we have history for alerts,
// daily cron analysis, and offline fallback.
// ================================================================
const mongoose = require("mongoose");

const weatherLogSchema = new mongoose.Schema(
  {
    // Location identifiers
    district: { type: String, required: true, trim: true, lowercase: true },
    state: { type: String, default: "Maharashtra", trim: true },
    lat: { type: Number },
    lon: { type: Number },

    // Current conditions
    temperature: { type: Number }, // °C
    feelsLike: { type: Number },
    humidity: { type: Number }, // %
    windSpeed: { type: Number }, // m/s
    windDeg: { type: Number }, // degrees
    rainfall: { type: Number, default: 0 }, // mm in last 1h
    cloudCover: { type: Number }, // % (0-100)
    visibility: { type: Number }, // metres
    uvIndex: { type: Number },
    pressure: { type: Number }, // hPa

    // Weather condition (from OpenWeatherMap)
    condition: { type: String }, // "Rain", "Clear", "Clouds" etc.
    description: { type: String }, // "light rain", "overcast clouds" etc.
    icon: { type: String }, // OpenWeatherMap icon code

    // 5-day forecast (array of daily forecasts)
    forecast: [
      {
        date: Date,
        tempMin: Number,
        tempMax: Number,
        humidity: Number,
        rainfall: Number,
        condition: String,
        description: String,
        windSpeed: Number,
      },
    ],

    // Computed risk scores per crop (stored so we don't recompute on every request)
    riskScores: [
      {
        crop: String,
        riskLevel: {
          type: String,
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        },
        riskScore: Number, // 0–100
        risks: [String], // e.g. ["Heavy rain risk", "Fungal disease risk"]
        advice: String,
        adviceMr: String,
        adviceHi: String,
      },
    ],

    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Fast lookup by district + date for caching and history
weatherLogSchema.index({ district: 1, fetchedAt: -1 });

// Auto-delete logs older than 30 days
weatherLogSchema.index(
  { fetchedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

module.exports = mongoose.model("WeatherLog", weatherLogSchema);
