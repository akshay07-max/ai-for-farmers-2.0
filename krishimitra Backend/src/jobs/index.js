// ================================================================
// CRON JOB SCHEDULER
// ================================================================
const cron = require("node-cron");
const logger = require("../utils/logger");

const { syncMarketPrices } = require("./marketSyncJob");
const { checkSubscriptionExpiry } = require("./subscriptionExpiryJob");
const { runWeatherAlerts } = require("./weatherAlertJob");

const startCronJobs = () => {
  if (process.env.ENABLE_CRON_JOBS !== "true") {
    logger.warn(
      "⚠️  Cron jobs disabled. Set ENABLE_CRON_JOBS=true in .env to enable.",
    );
    return;
  }

  logger.info("⏰ Starting cron jobs...");

  // Market price sync — daily 8:00 AM IST (after mandis open)
  cron.schedule(
    "0 8 * * *",
    async () => {
      logger.info("[CRON] Market price sync started");
      await syncMarketPrices();
    },
    { timezone: "Asia/Kolkata" },
  );

  // Weather alerts — 6:00 AM + 6:00 PM IST (morning + evening check)
  cron.schedule(
    "0 6,18 * * *",
    async () => {
      logger.info("[CRON] Weather alert check started");
      await runWeatherAlerts();
    },
    { timezone: "Asia/Kolkata" },
  );

  // Subscription expiry check — daily 9:00 AM IST
  cron.schedule(
    "0 9 * * *",
    async () => {
      logger.info("[CRON] Subscription expiry check started");
      await checkSubscriptionExpiry();
    },
    { timezone: "Asia/Kolkata" },
  );

  logger.info("✅ Cron jobs scheduled");
  logger.info("   • Market price sync:    daily  8:00 AM IST");
  logger.info("   • Weather alerts:       daily  6:00 AM + 6:00 PM IST");
  logger.info("   • Subscription expiry:  daily  9:00 AM IST");
};

module.exports = { startCronJobs };
