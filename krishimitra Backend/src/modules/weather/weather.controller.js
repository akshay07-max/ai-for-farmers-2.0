const weatherService = require("./weather.service");
const { sendSuccess, sendError } = require("../../utils/response");

/**
 * GET /api/v1/weather/districts
 * Returns list of supported districts. Public.
 */
async function getDistricts(req, res, next) {
  try {
    const districts = await weatherService.getSupportedDistricts();
    sendSuccess(res, 200, "Supported districts fetched.", { districts });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/weather/current?district=nashik&crops=onion,wheat&lang=mr
 * Returns current weather + crop risk scores.
 * Protected — requires login.
 *
 * Query params:
 *   district  (required)  — e.g. "nashik"
 *   crops     (optional)  — comma-separated: "onion,wheat,tomato"
 *   lang      (optional)  — "mr" | "hi" | "en" (default: user's preference)
 */
async function getCurrentWeather(req, res, next) {
  try {
    const { district, crops, lang } = req.query;

    if (!district) {
      return sendError(
        res,
        400,
        "'district' query parameter is required. Example: ?district=nashik",
        "ERR_VAL_001",
      );
    }

    // Parse crops from comma-separated string: "onion,wheat" → ["onion", "wheat"]
    const cropList = crops
      ? crops.split(",").map((c) => c.trim().toLowerCase())
      : [];
    // Use query lang, or fall back to user's preference set during registration
    const language = lang || req.user?.languagePreference || "en";

    const data = await weatherService.getWeatherAndRisk(
      district,
      cropList,
      language,
    );
    sendSuccess(res, 200, "Weather and crop risk fetched successfully.", {
      weather: data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/weather/forecast?district=nashik
 * Returns 5-day forecast. Protected.
 */
async function getForecast(req, res, next) {
  try {
    const { district } = req.query;
    if (!district) {
      return sendError(res, 400, "'district' is required.", "ERR_VAL_001");
    }
    const data = await weatherService.getForecast(district);
    sendSuccess(res, 200, "5-day forecast fetched.", { forecast: data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/weather/my-risk
 * Shortcut: uses the logged-in farmer's own district + primaryCrops
 * so they don't have to pass query params every time.
 * Protected.
 */
async function getMyRisk(req, res, next) {
  try {
    const user = req.user;

    if (!user.district) {
      return sendError(
        res,
        400,
        "Your profile doesn't have a district set. Please update your profile first.",
        "ERR_PROFILE_001",
      );
    }

    const data = await weatherService.getWeatherAndRisk(
      user.district,
      user.primaryCrops || [],
      user.languagePreference || "en",
    );

    sendSuccess(res, 200, "Your weather risk fetched.", { weather: data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDistricts, getCurrentWeather, getForecast, getMyRisk };
