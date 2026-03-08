const express = require("express");
const router = express.Router();
const controller = require("./weather.controller");
const { protect } = require("../../middlewares/auth");

// Public — no auth required
router.get("/districts", controller.getDistricts);

// Protected — requires valid JWT
router.get("/current", protect, controller.getCurrentWeather);
router.get("/forecast", protect, controller.getForecast);
router.get("/my-risk", protect, controller.getMyRisk);

module.exports = router;
