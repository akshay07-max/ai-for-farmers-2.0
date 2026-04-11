// ================================================================
// ADMIN SERVICE — all admin business logic
// ================================================================
const jwt = require("jsonwebtoken");
const Admin = require("../../models/Admin");
const User = require("../../models/User");
const Course = require("../../models/Course");
const Subscription = require("../../models/Subscription");
const LearningSubscription = require("../../models/LearningSubscription");
const LearningPath = require("../../models/LearningPath");
const Notification = require("../../models/Notification");
const HealthLog = require("../../models/HealthLog");
const ChatSession = require("../../models/ChatSession");
const axios = require("axios");
const notificationService = require("../../services/notificationService");
const { AppError } = require("../../middlewares/errorHandler");
const logger = require("../../utils/logger");

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// ── Auth ──────────────────────────────────────────────────────

const adminLogin = async (email, password) => {
  const admin = await Admin.findOne({ email, isActive: true }).select(
    "+password",
  );
  if (!admin) throw new AppError("Invalid credentials.", 401, "ERR_ADM_001");

  const valid = await admin.comparePassword(password);
  if (!valid) throw new AppError("Invalid credentials.", 401, "ERR_ADM_001");

  const token = jwt.sign(
    { id: admin._id, role: admin.role, type: "ADMIN" },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: "8h" },
  );

  await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });
  logger.info(`Admin login: ${admin.email} (${admin.role})`);

  return { token, admin: admin.toSafeObject() };
};

// ── User Management ───────────────────────────────────────────

const getUsers = async ({
  page = 1,
  limit = 20,
  search,
  district,
  isActive,
  isVerified,
}) => {
  const query = {};
  if (search)
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  if (district) query.district = { $regex: district, $options: "i" };
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (isVerified !== undefined) query.isVerified = isVerified === "true";

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("-refreshTokens"),
    User.countDocuments(query),
  ]);

  return {
    users,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  };
};

const getUserDetail = async (userId) => {
  const user = await User.findById(userId).select("-refreshTokens");
  if (!user) throw new AppError("User not found.", 404, "ERR_ADM_002");

  const [sub, learningSub, notifCount, chatCount] = await Promise.all([
    Subscription.findOne({ userId }),
    LearningSubscription.findOne({ userId }),
    Notification.countDocuments({ userId }),
    ChatSession.countDocuments({ userId }),
  ]);

  return {
    user,
    subscription: sub,
    learningSubscription: learningSub,
    notifCount,
    chatCount,
  };
};

const banUser = async (userId, reason, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false },
    { new: true },
  );
  if (!user) throw new AppError("User not found.", 404, "ERR_ADM_002");
  logger.info(`User banned: ${userId} by admin ${adminId}. Reason: ${reason}`);
  return { banned: true, userId };
};

const unbanUser = async (userId, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: true },
    { new: true },
  );
  if (!user) throw new AppError("User not found.", 404, "ERR_ADM_002");
  logger.info(`User unbanned: ${userId} by admin ${adminId}`);
  return { unbanned: true, userId };
};

// ── Analytics ─────────────────────────────────────────────────

const getAnalytics = async () => {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    newUsers7Days,
    newUsers30Days,
    verifiedUsers,
    activeUsers,
    totalRevenue,
    revenueThisMonth,
    learningRevenue,
    activeCourses,
    completedCourses,
    totalSessions,
    cattleAlerts,
    totalNotifications,
    smsCount,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: today } }),
    User.countDocuments({ createdAt: { $gte: last7Days } }),
    User.countDocuments({ createdAt: { $gte: last30Days } }),
    User.countDocuments({ isVerified: true }),
    User.countDocuments({ isActive: true }),

    // Revenue from main subscriptions
    Subscription.aggregate([
      { $unwind: "$payments" },
      { $group: { _id: null, total: { $sum: "$payments.amount" } } },
    ]),
    Subscription.aggregate([
      { $unwind: "$payments" },
      { $match: { "payments.paidAt": { $gte: last30Days } } },
      { $group: { _id: null, total: { $sum: "$payments.amount" } } },
    ]),

    // Revenue from learning subscriptions
    LearningSubscription.aggregate([
      { $unwind: "$payments" },
      { $group: { _id: null, total: { $sum: "$payments.amount" } } },
    ]),

    LearningPath.countDocuments({ status: "IN_PROGRESS" }),
    LearningPath.countDocuments({ status: "COMPLETED" }),
    ChatSession.countDocuments(),

    // Cattle HIGH/CRITICAL alerts in last 30 days
    HealthLog.countDocuments({
      "anomaly.riskLevel": { $in: ["HIGH", "CRITICAL"] },
      createdAt: { $gte: last30Days },
    }),

    Notification.countDocuments(),
    Notification.countDocuments({ "channels.sms": true }),
  ]);

  // DAU — users who received a notification today (proxy for activity)
  const dau = await Notification.distinct("userId", {
    createdAt: { $gte: today },
  });

  // District distribution
  const districtStats = await User.aggregate([
    { $group: { _id: "$district", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Crop distribution
  const cropStats = await User.aggregate([
    { $unwind: "$primaryCrops" },
    { $group: { _id: "$primaryCrops", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // New user signups per day (last 7 days)
  const signupTrend = await User.aggregate([
    { $match: { createdAt: { $gte: last7Days } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totalRevenueAmount =
    (totalRevenue[0]?.total || 0) + (learningRevenue[0]?.total || 0);
  const monthlyRevenueAmount = revenueThisMonth[0]?.total || 0;

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      active: activeUsers,
      dau: dau.length,
      newToday: newUsersToday,
      new7Days: newUsers7Days,
      new30Days: newUsers30Days,
      signupTrend,
    },
    revenue: {
      total: Math.round(totalRevenueAmount / 100), // convert paise to rupees
      thisMonth: Math.round(monthlyRevenueAmount / 100),
    },
    learning: {
      activeCourses,
      completedCourses,
      totalSessions,
    },
    cattle: {
      alertsLast30Days: cattleAlerts,
    },
    notifications: {
      total: totalNotifications,
      sms: smsCount,
    },
    geography: {
      topDistricts: districtStats,
      topCrops: cropStats,
    },
  };
};

const getRevenueReport = async (days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [mainSubs, learningSubs] = await Promise.all([
    Subscription.aggregate([
      { $unwind: "$payments" },
      { $match: { "payments.paidAt": { $gte: since } } },
      {
        $group: {
          _id: "$plan",
          count: { $sum: 1 },
          total: { $sum: "$payments.amount" },
        },
      },
    ]),
    LearningSubscription.aggregate([
      { $unwind: "$payments" },
      { $match: { "payments.paidAt": { $gte: since } } },
      {
        $group: {
          _id: "$plan",
          count: { $sum: 1 },
          total: { $sum: "$payments.amount" },
        },
      },
    ]),
  ]);

  return {
    period: `Last ${days} days`,
    mainApp: mainSubs.map((s) => ({
      ...s,
      totalRupees: Math.round(s.total / 100),
    })),
    learning: learningSubs.map((s) => ({
      ...s,
      totalRupees: Math.round(s.total / 100),
    })),
    grandTotal: Math.round(
      [...mainSubs, ...learningSubs].reduce((s, r) => s + r.total, 0) / 100,
    ),
  };
};

// ── Knowledge Base Management (RAG) ──────────────────────────

const addKnowledge = async (content, title, category, language, source) => {
  try {
    const response = await axios.post(
      `${AI_URL}/rag/ingest/text`,
      {
        content,
        title,
        category,
        language,
        source,
      },
      { timeout: 30000 },
    );
    logger.info(
      `Knowledge ingested: "${title}" — ${response.data.chunks_stored} chunks`,
    );
    return response.data;
  } catch (err) {
    throw new AppError(
      `RAG ingestion failed: ${err.response?.data?.detail || err.message}`,
      502,
      "ERR_ADM_003",
    );
  }
};

const uploadKnowledgePDF = async (
  pdfBuffer,
  filename,
  title,
  category,
  language,
) => {
  const FormData = require("form-data");
  const form = new FormData();
  form.append("file", pdfBuffer, { filename, contentType: "application/pdf" });
  form.append("title", title);
  form.append("category", category);
  form.append("language", language);

  try {
    const response = await axios.post(`${AI_URL}/rag/ingest/pdf`, form, {
      headers: { ...form.getHeaders() },
      timeout: 60000,
    });
    logger.info(
      `PDF ingested: "${title}" — ${response.data.chunks_stored} chunks`,
    );
    return response.data;
  } catch (err) {
    throw new AppError(
      `PDF ingestion failed: ${err.response?.data?.detail || err.message}`,
      502,
      "ERR_ADM_004",
    );
  }
};

const queryKnowledge = async (query, language, category) => {
  try {
    const response = await axios.post(
      `${AI_URL}/rag/query`,
      {
        query,
        language,
        top_k: 10,
        category,
      },
      { timeout: 15000 },
    );
    return response.data;
  } catch (err) {
    throw new AppError(`RAG query failed: ${err.message}`, 502, "ERR_ADM_005");
  }
};

// ── Broadcast Notifications ───────────────────────────────────

const broadcastNotification = async (
  adminId,
  { title, body, channel, filters },
) => {
  // Build user query from filters
  const query = { isActive: true, isVerified: true };
  if (filters?.district)
    query.district = { $regex: filters.district, $options: "i" };
  if (filters?.plan) {
    // Filter by subscription plan — need to join with Subscription
    // For now filter all users and check subscription separately
  }
  if (filters?.primaryCrop) query.primaryCrops = { $in: [filters.primaryCrop] };

  const users = await User.find(query).select(
    "_id fcmToken phone languagePreference",
  );
  logger.info(`Broadcast to ${users.length} users | admin: ${adminId}`);

  let sent = 0,
    failed = 0;

  // Send in batches of 50 to avoid overwhelming services
  const batchSize = 50;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (user) => {
        try {
          await notificationService.send({
            userId: user._id,
            module: "ADMIN",
            type: "PRICE_ALERT", // reuse type
            channels: {
              push: channel === "PUSH" || channel === "BOTH",
              sms: channel === "SMS" || channel === "BOTH",
            },
            title,
            body,
          });
          sent++;
        } catch {
          failed++;
        }
      }),
    );
    // Small delay between batches
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.info(`Broadcast complete: ${sent} sent, ${failed} failed`);
  return { totalTargeted: users.length, sent, failed };
};

// ── Course Management ─────────────────────────────────────────

const getCourses = async ({ page = 1, limit = 20, published }) => {
  const query = {};
  if (published !== undefined) query.isPublished = published === "true";

  const [courses, total] = await Promise.all([
    Course.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select(
        "title titleMr category difficulty isPublished enrollmentCount createdAt",
      ),
    Course.countDocuments(query),
  ]);

  return {
    courses,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  };
};

const publishCourse = async (courseId) => {
  const course = await Course.findByIdAndUpdate(
    courseId,
    { isPublished: true },
    { new: true },
  );
  if (!course) throw new AppError("Course not found.", 404, "ERR_ADM_006");
  return course;
};

const unpublishCourse = async (courseId) => {
  const course = await Course.findByIdAndUpdate(
    courseId,
    { isPublished: false },
    { new: true },
  );
  if (!course) throw new AppError("Course not found.", 404, "ERR_ADM_006");
  return course;
};

const addLesson = async (courseId, moduleId, lessonData) => {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError("Course not found.", 404, "ERR_ADM_006");

  const mod = course.modules.id(moduleId);
  if (!mod) throw new AppError("Module not found.", 404, "ERR_ADM_007");

  // Auto-sequence — add after last lesson
  const nextSeq = Math.max(0, ...mod.lessons.map((l) => l.sequence)) + 1;
  mod.lessons.push({ ...lessonData, sequence: nextSeq });
  await course.save();

  return course;
};

const createCourse = async (courseData) => {
  const course = await Course.create({ ...courseData, createdBy: "ADMIN" });
  return course;
};

// ── Admin Management (SUPER_ADMIN only) ──────────────────────

const createAdmin = async (data, createdById) => {
  const existing = await Admin.findOne({ email: data.email });
  if (existing)
    throw new AppError(
      "Admin with this email already exists.",
      409,
      "ERR_ADM_008",
    );

  const admin = await Admin.create({ ...data, createdBy: createdById });
  logger.info(`New admin created: ${admin.email} by ${createdById}`);
  return admin.toSafeObject();
};

const getAdmins = async () => {
  return Admin.find().select("-password").sort({ createdAt: -1 });
};

module.exports = {
  adminLogin,
  getUsers,
  getUserDetail,
  banUser,
  unbanUser,
  getAnalytics,
  getRevenueReport,
  addKnowledge,
  uploadKnowledgePDF,
  queryKnowledge,
  broadcastNotification,
  getCourses,
  publishCourse,
  unpublishCourse,
  addLesson,
  createCourse,
  createAdmin,
  getAdmins,
};
