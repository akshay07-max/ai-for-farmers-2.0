// ================================================================
// KRISHIMITRA AI — MAIN SERVER FILE (Step 9 update)
// ================================================================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { initTwilio } = require("./config/twilio");
const { initFirebase } = require("./config/firebase");
const { initRazorpay } = require("./config/razorpay");
const { initS3 } = require("./config/s3");
const { startCronJobs } = require("./jobs/index");
const { errorHandler } = require("./middlewares/errorHandler");
const { apiLimiter } = require("./middlewares/rateLimiter");
const logger = require("./utils/logger");

const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/users.routes");
const marketRoutes = require("./modules/market/market.routes");
const weatherRoutes = require("./modules/weather/weather.routes");
const notifRoutes = require("./modules/notifications/notification.routes");
const paymentRoutes = require("./modules/payments/payment.routes");
const voiceRoutes = require("./modules/voice/voice.routes");
const chatRoutes = require("./modules/chat/chat.routes");
const cattleRoutes = require("./modules/cattle/cattle.routes");
const learningRoutes = require("./modules/learning/learning.routes");
const adminRoutes = require("./modules/admin/admin.routes"); // ← Step 9

const app = express();

connectDB();
connectRedis();
initTwilio();
initFirebase();
initRazorpay();
initS3();
setTimeout(() => startCronJobs(), 3000);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept-Language",
      "X-Device-Token",
    ],
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    }),
  );
}

app.use("/api", apiLimiter);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "krishimitra-backend",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/market", marketRoutes);
app.use("/api/v1/weather", weatherRoutes);
app.use("/api/v1/notifications", notifRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/voice", voiceRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/cattle", cattleRoutes);
app.use("/api/v1/learning", learningRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: "ERR_NOT_FOUND",
    message: `Route '${req.method} ${req.originalUrl}' not found.`,
  });
});

app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    logger.info("════════════════════════════════════");
    logger.info("  🌾 KrishiMitra AI Backend Started");
    logger.info(`  📡 Port        : ${PORT}`);
    logger.info(`  🌍 Environment : ${process.env.NODE_ENV}`);
    logger.info(`  🔗 API Base    : http://localhost:${PORT}/api/v1`);
    logger.info("════════════════════════════════════");
  });
  process.on("SIGTERM", () => {
    server.close(() => {
      logger.info("Server closed.");
      process.exit(0);
    });
  });
}

module.exports = app;
