// ================================================================
// LEARNING REMINDER JOB
// Runs daily at 8:00 AM IST.
// Sends reminders to farmers who haven't studied in 2+ days.
// ================================================================
const LearningPath = require("../models/LearningPath");
const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

const checkLearningReminders = async () => {
  logger.info("[LearningReminder] Checking streak reminders...");

  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Farmers with active courses who haven't studied in 2+ days
    const stalePaths = await LearningPath.find({
      status: { $in: ["ENROLLED", "IN_PROGRESS"] },
      lastStudiedAt: { $lt: twoDaysAgo },
    })
      .select("userId courseId streak")
      .populate("courseId", "titleMr title");

    logger.info(`[LearningReminder] ${stalePaths.length} reminders to send`);

    for (const path of stalePaths) {
      const courseName =
        path.courseId?.titleMr || path.courseId?.title || "your course";

      await notificationService.send({
        userId: path.userId,
        module: "LEARNING",
        type: "CATTLE_HEALTH_ALERT", // reusing type — will add LEARNING type in next step
        channels: { push: true, sms: false },
        title: "📚 शेती मित्र तुमची वाट पाहतोय!",
        body: `${courseName} मधला पुढचा धडा तयार आहे. आजचे शिकणे सुरू करा! 🌱`,
        data: {
          courseId: String(path.courseId?._id),
          type: "LEARNING_REMINDER",
        },
      });
    }

    logger.info(`[LearningReminder] ${stalePaths.length} reminders sent.`);
  } catch (err) {
    logger.error(`[LearningReminder] Failed: ${err.message}`);
  }
};

module.exports = { checkLearningReminders };
