// ================================================================
// LEARNING CONTROLLER
// ================================================================
const svc = require("./learning.service");
const { sendSuccess, sendError } = require("../../utils/response");

// ── Plans & Subscription ──────────────────────────────────────
const getPlans = (req, res, next) => {
  try {
    sendSuccess(res, 200, "Learning plans.", { plans: svc.getPlans() });
  } catch (err) {
    next(err);
  }
};

const getMySubscription = async (req, res, next) => {
  try {
    const sub = await svc.getMySubscription(req.user._id);
    sendSuccess(res, 200, "Learning subscription.", { subscription: sub });
  } catch (err) {
    next(err);
  }
};

// ── Catalogue ─────────────────────────────────────────────────
const getCourses = async (req, res, next) => {
  try {
    const courses = await svc.getCourses(req.query);
    sendSuccess(res, 200, `${courses.length} courses found.`, { courses });
  } catch (err) {
    next(err);
  }
};

const getCourse = async (req, res, next) => {
  try {
    const course = await svc.getCourseDetail(req.params.courseId);
    sendSuccess(res, 200, "Course detail.", { course });
  } catch (err) {
    next(err);
  }
};

// ── Enrollment ────────────────────────────────────────────────
const enroll = async (req, res, next) => {
  try {
    const path = await svc.enrollCourse(
      req.user._id,
      req.params.courseId,
      req.body.language || null,
    );
    sendSuccess(res, 201, "Enrolled successfully.", { path });
  } catch (err) {
    next(err);
  }
};

const getMyPaths = async (req, res, next) => {
  try {
    const paths = await svc.getMyPaths(req.user._id);
    sendSuccess(res, 200, "My learning paths.", { paths });
  } catch (err) {
    next(err);
  }
};

const getMyPath = async (req, res, next) => {
  try {
    const path = await svc.getMyPath(req.user._id, req.params.courseId);
    sendSuccess(res, 200, "Learning path.", { path });
  } catch (err) {
    next(err);
  }
};

// ── Lesson Content ────────────────────────────────────────────
const getLessonContent = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const { language } = req.query;
    const result = await svc.getLessonContent(
      req.user._id,
      courseId,
      lessonId,
      language,
    );
    sendSuccess(res, 200, "Lesson content.", result);
  } catch (err) {
    next(err);
  }
};

// ── Live Tutor ────────────────────────────────────────────────
const startSession = async (req, res, next) => {
  try {
    const { courseId, lessonId, language } = req.body;
    if (!courseId || !lessonId) {
      return sendError(
        res,
        400,
        "courseId and lessonId are required.",
        "ERR_VAL_001",
      );
    }
    const result = await svc.startTutorSession(
      req.user._id,
      courseId,
      lessonId,
      language,
    );
    sendSuccess(res, 201, "Tutor session started.", result);
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim())
      return sendError(res, 400, "Message is required.", "ERR_VAL_001");
    const result = await svc.sendTutorMessage(
      req.user._id,
      req.params.sessionId,
      message.trim(),
    );
    sendSuccess(res, 200, "Message sent.", result);
  } catch (err) {
    next(err);
  }
};

const completeSession = async (req, res, next) => {
  try {
    const result = await svc.completeTutorSession(
      req.user._id,
      req.params.sessionId,
    );
    sendSuccess(res, 200, "Session completed.", result);
  } catch (err) {
    next(err);
  }
};

// ── Quiz ──────────────────────────────────────────────────────
const getQuiz = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const questions = await svc.getQuiz(
      req.user._id,
      courseId,
      lessonId,
      req.query.language,
    );
    sendSuccess(res, 200, "Quiz questions.", { questions });
  } catch (err) {
    next(err);
  }
};

const submitQuiz = async (req, res, next) => {
  try {
    const { courseId, lessonId } = req.params;
    const { answers, language } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return sendError(res, 400, "answers array is required.", "ERR_VAL_001");
    }
    const result = await svc.submitQuiz(
      req.user._id,
      courseId,
      lessonId,
      answers,
      language,
    );
    sendSuccess(res, 200, result.passed ? "Quiz passed!" : "Quiz complete.", {
      quiz: result,
    });
  } catch (err) {
    next(err);
  }
};

// ── Syllabus Builder ──────────────────────────────────────────
const syllabusChat = async (req, res, next) => {
  try {
    const { message, history = [], language } = req.body;
    if (!message?.trim())
      return sendError(res, 400, "Message is required.", "ERR_VAL_001");
    const result = await svc.syllabusChat(
      req.user._id,
      message.trim(),
      history,
      language,
    );
    sendSuccess(res, 200, "Sheti Mitra response.", result);
  } catch (err) {
    next(err);
  }
};

// ── Stats ─────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const stats = await svc.getStats(req.user._id);
    sendSuccess(res, 200, "Learning stats.", { stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPlans,
  getMySubscription,
  getCourses,
  getCourse,
  enroll,
  getMyPaths,
  getMyPath,
  getLessonContent,
  startSession,
  sendMessage,
  completeSession,
  getQuiz,
  submitQuiz,
  syllabusChat,
  getStats,
};
