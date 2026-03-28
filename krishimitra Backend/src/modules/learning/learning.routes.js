// ================================================================
// LEARNING ROUTES
// ================================================================
const express = require("express");
const router = express.Router();
const { protect } = require("../../middlewares/auth");
const c = require("./learning.controller");

// ── Plans & Subscription (independent of main app) ───────────
router.get("/plans", c.getPlans);
router.get("/subscription", protect, c.getMySubscription);

// ── Course Catalogue ──────────────────────────────────────────
router.get("/courses", c.getCourses); // public
router.get("/courses/:courseId", c.getCourse); // public

// ── My Learning ───────────────────────────────────────────────
router.post("/enroll/:courseId", protect, c.enroll);
router.get("/my-paths", protect, c.getMyPaths);
router.get("/my-paths/:courseId", protect, c.getMyPath);
router.get("/stats", protect, c.getStats);

// ── Lesson Content ────────────────────────────────────────────
router.get(
  "/courses/:courseId/lessons/:lessonId/content",
  protect,
  c.getLessonContent,
);

// ── Live Tutor Session ────────────────────────────────────────
router.post("/session/start", protect, c.startSession);
router.post("/session/:sessionId/message", protect, c.sendMessage);
router.post("/session/:sessionId/complete", protect, c.completeSession);

// ── Quiz ──────────────────────────────────────────────────────
router.get("/courses/:courseId/lessons/:lessonId/quiz", protect, c.getQuiz);
router.post(
  "/courses/:courseId/lessons/:lessonId/quiz/submit",
  protect,
  c.submitQuiz,
);

// ── Syllabus Builder ──────────────────────────────────────────
router.post("/syllabus/chat", protect, c.syllabusChat);

module.exports = router;
