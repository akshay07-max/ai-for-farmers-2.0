// ================================================================
// ADMIN CONTROLLER
// ================================================================
const svc = require("./admin.service");
const { sendSuccess, sendError } = require("../../utils/response");

// ── Auth ──────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return sendError(res, 400, "Email and password required.", "ERR_VAL_001");
    const result = await svc.adminLogin(email, password);
    sendSuccess(res, 200, "Admin login successful.", result);
  } catch (err) {
    next(err);
  }
};

const getMe = (req, res) => {
  sendSuccess(res, 200, "Admin profile.", { admin: req.admin });
};

// ── User Management ───────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const result = await svc.getUsers(req.query);
    sendSuccess(res, 200, `${result.total} users found.`, result);
  } catch (err) {
    next(err);
  }
};

const getUserDetail = async (req, res, next) => {
  try {
    const result = await svc.getUserDetail(req.params.userId);
    sendSuccess(res, 200, "User detail.", result);
  } catch (err) {
    next(err);
  }
};

const banUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await svc.banUser(req.params.userId, reason, req.admin._id);
    sendSuccess(res, 200, "User banned.", result);
  } catch (err) {
    next(err);
  }
};

const unbanUser = async (req, res, next) => {
  try {
    const result = await svc.unbanUser(req.params.userId, req.admin._id);
    sendSuccess(res, 200, "User unbanned.", result);
  } catch (err) {
    next(err);
  }
};

// ── Analytics ─────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const data = await svc.getAnalytics();
    sendSuccess(res, 200, "Analytics fetched.", { analytics: data });
  } catch (err) {
    next(err);
  }
};

const getRevenueReport = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const data = await svc.getRevenueReport(parseInt(days));
    sendSuccess(res, 200, "Revenue report.", { revenue: data });
  } catch (err) {
    next(err);
  }
};

// ── Knowledge Base ────────────────────────────────────────────
const addKnowledge = async (req, res, next) => {
  try {
    const { content, title, category, language, source } = req.body;
    if (!content || !title || !category)
      return sendError(
        res,
        400,
        "content, title, and category are required.",
        "ERR_VAL_001",
      );
    const result = await svc.addKnowledge(
      content,
      title,
      category,
      language || "mr",
      source,
    );
    sendSuccess(res, 201, "Knowledge added to AI knowledge base.", result);
  } catch (err) {
    next(err);
  }
};

const uploadKnowledgePDF = async (req, res, next) => {
  try {
    if (!req.file)
      return sendError(res, 400, "PDF file is required.", "ERR_VAL_001");
    const { title, category, language } = req.body;
    if (!title || !category)
      return sendError(
        res,
        400,
        "title and category are required.",
        "ERR_VAL_001",
      );
    const result = await svc.uploadKnowledgePDF(
      req.file.buffer,
      req.file.originalname,
      title,
      category,
      language || "mr",
    );
    sendSuccess(res, 201, "PDF ingested into AI knowledge base.", result);
  } catch (err) {
    next(err);
  }
};

const queryKnowledge = async (req, res, next) => {
  try {
    const { query, language, category } = req.query;
    if (!query) return sendError(res, 400, "query is required.", "ERR_VAL_001");
    const result = await svc.queryKnowledge(query, language || "mr", category);
    sendSuccess(res, 200, "Knowledge base query results.", result);
  } catch (err) {
    next(err);
  }
};

// ── Broadcast ─────────────────────────────────────────────────
const broadcastNotification = async (req, res, next) => {
  try {
    const { title, body, channel, filters } = req.body;
    if (!title || !body || !channel)
      return sendError(
        res,
        400,
        "title, body, and channel are required.",
        "ERR_VAL_001",
      );
    if (!["PUSH", "SMS", "BOTH"].includes(channel))
      return sendError(
        res,
        400,
        "channel must be PUSH, SMS, or BOTH.",
        "ERR_VAL_002",
      );
    const result = await svc.broadcastNotification(req.admin._id, {
      title,
      body,
      channel,
      filters,
    });
    sendSuccess(res, 200, "Broadcast sent.", result);
  } catch (err) {
    next(err);
  }
};

// ── Courses ───────────────────────────────────────────────────
const getCourses = async (req, res, next) => {
  try {
    const result = await svc.getCourses(req.query);
    sendSuccess(res, 200, `${result.total} courses.`, result);
  } catch (err) {
    next(err);
  }
};

const createCourse = async (req, res, next) => {
  try {
    const course = await svc.createCourse(req.body);
    sendSuccess(res, 201, "Course created.", { course });
  } catch (err) {
    next(err);
  }
};

const publishCourse = async (req, res, next) => {
  try {
    const course = await svc.publishCourse(req.params.courseId);
    sendSuccess(res, 200, "Course published.", { course });
  } catch (err) {
    next(err);
  }
};

const unpublishCourse = async (req, res, next) => {
  try {
    const course = await svc.unpublishCourse(req.params.courseId);
    sendSuccess(res, 200, "Course unpublished.", { course });
  } catch (err) {
    next(err);
  }
};

const addLesson = async (req, res, next) => {
  try {
    const { courseId, moduleId } = req.params;
    const course = await svc.addLesson(courseId, moduleId, req.body);
    sendSuccess(res, 201, "Lesson added.", { course });
  } catch (err) {
    next(err);
  }
};

// ── Admin Management ──────────────────────────────────────────
const getAdmins = async (req, res, next) => {
  try {
    const admins = await svc.getAdmins();
    sendSuccess(res, 200, `${admins.length} admins.`, { admins });
  } catch (err) {
    next(err);
  }
};

const createAdmin = async (req, res, next) => {
  try {
    const admin = await svc.createAdmin(req.body, req.admin._id);
    sendSuccess(res, 201, "Admin created.", { admin });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe,
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
  createCourse,
  publishCourse,
  unpublishCourse,
  addLesson,
  getAdmins,
  createAdmin,
};
