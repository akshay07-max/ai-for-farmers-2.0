// ================================================================
// CATTLE ROUTES
// ================================================================
const express = require("express");
const router = express.Router();
const { protect } = require("../../middlewares/auth");
const c = require("./cattle.controller");

// ── Cattle CRUD ───────────────────────────────────────────────
router.post("/", protect, c.addCattle);
router.get("/", protect, c.getMyCattle);
router.get("/:cattleId", protect, c.getCattle);
router.put("/:cattleId", protect, c.updateCattle);
router.delete("/:cattleId", protect, c.removeCattle);

// ── Health logs ───────────────────────────────────────────────
router.post("/:cattleId/health", protect, c.addHealthLog);
router.get("/:cattleId/health", protect, c.getHealthHistory);

// ── Milk stats ────────────────────────────────────────────────
router.get("/:cattleId/milk", protect, c.getMilkStats);

// ── Vaccinations ──────────────────────────────────────────────
router.post("/:cattleId/vaccinations", protect, c.addVaccination);
router.get("/:cattleId/vaccinations", protect, c.getVaccinations);

// ── IoT device ────────────────────────────────────────────────
router.post("/:cattleId/device/register", protect, c.registerDevice);

// IoT reading endpoint — NO JWT auth, uses X-Device-Token header
// This is what your ESP32 SmartTag calls every 30-60 minutes
router.post("/iot/reading", c.iotReading);

module.exports = router;
