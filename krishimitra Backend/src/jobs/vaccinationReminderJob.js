// ================================================================
// VACCINATION REMINDER JOB
// Runs daily at 9:30 AM IST.
// Sends reminders 7 days before vaccination due date.
// ================================================================
const Vaccination = require("../models/Vaccination");
const Cattle = require("../models/Cattle");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

const checkVaccinationReminders = async () => {
  logger.info("[VaccinationReminder] Starting check...");

  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find all vaccinations due in the next 7 days, reminder not yet sent
    const upcoming = await Vaccination.find({
      nextDueDate: { $gte: now, $lte: in7Days },
      reminderSent: false,
    }).populate("cattleId", "name ownerId");

    logger.info(`[VaccinationReminder] ${upcoming.length} reminders to send`);

    for (const vacc of upcoming) {
      const cattle = vacc.cattleId;
      if (!cattle) continue;

      const daysLeft = Math.ceil(
        (vacc.nextDueDate - now) / (1000 * 60 * 60 * 24),
      );

      await notificationService.send({
        userId: cattle.ownerId,
        module: "CATTLE",
        type: "CATTLE_HEALTH_ALERT",
        channels: { push: true, sms: daysLeft <= 3 },
        title: `💉 Vaccination Due in ${daysLeft} days`,
        body: `${cattle.name}: ${vacc.vaccineName} is due on ${vacc.nextDueDate.toDateString()}. Contact your vet.`,
        data: {
          cattleId: String(cattle._id),
          vaccId: String(vacc._id),
          daysLeft: String(daysLeft),
        },
      });

      // Mark reminder as sent
      await Vaccination.findByIdAndUpdate(vacc._id, { reminderSent: true });
      logger.info(
        `[VaccinationReminder] Sent: ${cattle.name} | ${vacc.vaccineName} | ${daysLeft}d`,
      );
    }

    logger.info(
      `[VaccinationReminder] Complete. ${upcoming.length} reminders sent.`,
    );
  } catch (err) {
    logger.error(`[VaccinationReminder] Failed: ${err.message}`);
  }
};

module.exports = { checkVaccinationReminders };
