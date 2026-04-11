// ================================================================
// ADMIN ROUTES
// All routes except /login are protected by adminAuth middleware.
// ================================================================
const express = require("express");
const multer = require("multer");
const router = express.Router();
const c = require("./admin.controller");
const { adminAuth, requirePermission } = require("../../middlewares/adminAuth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Auth (public) ─────────────────────────────────────────────
router.post("/auth/login", c.login);

// All routes below require admin JWT
router.use(adminAuth);

router.get("/auth/me", c.getMe);

// ── Users ─────────────────────────────────────────────────────
router.get("/users", requirePermission("manageUsers"), c.getUsers);
router.get("/users/:userId", requirePermission("manageUsers"), c.getUserDetail);
router.patch("/users/:userId/ban", requirePermission("manageUsers"), c.banUser);
router.patch(
  "/users/:userId/unban",
  requirePermission("manageUsers"),
  c.unbanUser,
);

// ── Analytics ─────────────────────────────────────────────────
router.get("/analytics", requirePermission("viewAnalytics"), c.getAnalytics);
router.get(
  "/analytics/revenue",
  requirePermission("viewAnalytics"),
  c.getRevenueReport,
);

// ── Knowledge Base (RAG) ──────────────────────────────────────
router.post(
  "/knowledge/text",
  requirePermission("manageContent"),
  c.addKnowledge,
);
router.post(
  "/knowledge/pdf",
  requirePermission("manageContent"),
  upload.single("file"),
  c.uploadKnowledgePDF,
);
router.get(
  "/knowledge/query",
  requirePermission("manageContent"),
  c.queryKnowledge,
);

// ── Broadcast Notifications ───────────────────────────────────
router.post(
  "/broadcast",
  requirePermission("manageNotifications"),
  c.broadcastNotification,
);

// ── Courses ───────────────────────────────────────────────────
router.get("/courses", requirePermission("manageContent"), c.getCourses);
router.post("/courses", requirePermission("manageContent"), c.createCourse);
router.patch(
  "/courses/:courseId/publish",
  requirePermission("manageContent"),
  c.publishCourse,
);
router.patch(
  "/courses/:courseId/unpublish",
  requirePermission("manageContent"),
  c.unpublishCourse,
);
router.post(
  "/courses/:courseId/modules/:moduleId/lessons",
  requirePermission("manageContent"),
  c.addLesson,
);

// ── Admin Management (SUPER_ADMIN only) ──────────────────────
router.get("/admins", c.getAdmins);
router.post("/admins", c.createAdmin);

module.exports = router;
