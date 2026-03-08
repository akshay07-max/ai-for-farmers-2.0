// ================================================================
// WEATHER ALERT JOB
// Runs twice daily (6 AM + 6 PM IST).
// Checks weather for every district that has farmers registered,
// and sends HIGH/CRITICAL risk alerts to affected farmers.
// ================================================================
const User = require("../models/User");
const { checkAndAlertFarmers } = require("../modules/weather/weather.service");
const logger = require("../utils/logger");

const runWeatherAlerts = async () => {
  logger.info("[WeatherAlert] Starting weather alert check...");

  try {
    // Find every unique district that has at least one active farmer
    const districts = await User.distinct("district", {
      isVerified: true,
      isActive: true,
      district: { $exists: true, $ne: null, $ne: "" },
      primaryCrops: { $exists: true, $ne: [] },
    });

    logger.info(`[WeatherAlert] Checking ${districts.length} districts...`);

    let alertsSent = 0;
    for (const district of districts) {
      if (!district) continue;
      await checkAndAlertFarmers(district);
      alertsSent++;
      // Small delay to avoid OpenWeatherMap rate limiting (60 calls/min free tier)
      await new Promise((r) => setTimeout(r, 1100));
    }

    logger.info(`[WeatherAlert] Complete. Checked ${alertsSent} districts.`);
  } catch (err) {
    logger.error(`[WeatherAlert] Job failed: ${err.message}`);
  }
};

module.exports = { runWeatherAlerts };
