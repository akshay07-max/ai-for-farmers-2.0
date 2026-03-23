// ================================================================
// CRON JOB SCHEDULER — Step 7 update
// ================================================================
const cron = require("node-cron");
const logger = require("../utils/logger");

const { syncMarketPrices } = require("./marketSyncJob");
const { checkSubscriptionExpiry } = require("./subscriptionExpiryJob");
const { runWeatherAlerts } = require("./weatherAlertJob");
const { checkVaccinationReminders } = require("./vaccinationReminderJob");
const { checkEstrusAlerts } = require("./estrusAlertJob");

const startCronJobs = () => {
  if (process.env.ENABLE_CRON_JOBS !== "true") {
    logger.warn("⚠️  Cron jobs disabled. Set ENABLE_CRON_JOBS=true to enable.");
    return;
  }

  logger.info("⏰ Starting cron jobs...");

  cron.schedule(
    "0 8 * * *",
    async () => {
      logger.info("[CRON] Market price sync");
      await syncMarketPrices();
    },
    { timezone: "Asia/Kolkata" },
  );

  cron.schedule(
    "0 6,18 * * *",
    async () => {
      logger.info("[CRON] Weather alerts");
      await runWeatherAlerts();
    },
    { timezone: "Asia/Kolkata" },
  );

  cron.schedule(
    "0 9 * * *",
    async () => {
      logger.info("[CRON] Subscription expiry check");
      await checkSubscriptionExpiry();
    },
    { timezone: "Asia/Kolkata" },
  );

  cron.schedule(
    "30 9 * * *",
    async () => {
      logger.info("[CRON] Vaccination reminders");
      await checkVaccinationReminders();
    },
    { timezone: "Asia/Kolkata" },
  );

  cron.schedule(
    "0 7 * * *",
    async () => {
      logger.info("[CRON] Estrus/breeding alerts");
      await checkEstrusAlerts();
    },
    { timezone: "Asia/Kolkata" },
  );

  logger.info("✅ Cron jobs scheduled");
  logger.info("   • Market price sync:      daily  8:00 AM IST");
  logger.info("   • Weather alerts:         daily  6:00 AM + 6:00 PM IST");
  logger.info("   • Subscription expiry:    daily  9:00 AM IST");
  logger.info("   • Vaccination reminders:  daily  9:30 AM IST");
  logger.info("   • Estrus alerts:          daily  7:00 AM IST");
};

module.exports = { startCronJobs };
