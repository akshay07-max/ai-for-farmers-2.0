// ================================================================
// ESTRUS ALERT JOB
// Runs daily at 7:00 AM IST.
// Alerts farmers when a female cattle is predicted to be in heat.
// Estrus cycle = 21 days. Window = today ±1 day.
// ================================================================
const Cattle = require("../models/Cattle");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

const checkEstrusAlerts = async () => {
  logger.info("[Estrus] Checking breeding alerts...");

  try {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Find all female cattle whose predicted heat date is today or tomorrow
    const cattle = await Cattle.find({
      gender: "FEMALE",
      isActive: true,
      isPregnant: false,
      nextHeatDate: { $gte: today, $lte: tomorrow },
    }).select("name ownerId nextHeatDate breed species");

    logger.info(`[Estrus] ${cattle.length} animals in heat today/tomorrow`);

    for (const animal of cattle) {
      await notificationService.send({
        userId: animal.ownerId,
        module: "CATTLE",
        type: "CATTLE_HEALTH_ALERT",
        channels: { push: true, sms: false },
        title: `🐄 ${animal.name} — Breeding Alert`,
        body: `${animal.name} is predicted to be in heat today/tomorrow. Best time for breeding or AI (Artificial Insemination).`,
        data: { cattleId: String(animal._id), type: "ESTRUS" },
      });

      // Update next heat date: +21 days from current
      const nextCycle = new Date(animal.nextHeatDate);
      nextCycle.setDate(nextCycle.getDate() + 21);
      await Cattle.findByIdAndUpdate(animal._id, {
        lastHeatDate: animal.nextHeatDate,
        nextHeatDate: nextCycle,
      });

      logger.info(
        `[Estrus] Alert sent: ${animal.name} | next predicted: ${nextCycle.toDateString()}`,
      );
    }

    logger.info(`[Estrus] Complete. ${cattle.length} alerts sent.`);
  } catch (err) {
    logger.error(`[Estrus] Failed: ${err.message}`);
  }
};

module.exports = { checkEstrusAlerts };
