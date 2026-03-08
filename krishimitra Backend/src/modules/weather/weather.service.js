// ================================================================
// WEATHER SERVICE
// Fetches real weather from OpenWeatherMap, scores crop risk,
// stores history, and triggers notifications on HIGH/CRITICAL risk.
// ================================================================
const axios = require("axios");
const WeatherLog = require("../../models/WeatherLog");
const User = require("../../models/User");
const { redis } = require("../../config/redis");
const { AppError } = require("../../middlewares/errorHandler");
const notificationService = require("../../services/notificationService");
const logger = require("../../utils/logger");

const CACHE_TTL = 60 * 60; // 1 hour — weather doesn't change minute by minute

// ── District → coordinates map ────────────────────────────────────────────────
// OpenWeatherMap works best with lat/lon. This avoids spelling issues with
// Indian district names. Add more districts as your user base grows.
const DISTRICT_COORDS = {
  nashik: { lat: 20.0, lon: 73.78, display: "Nashik" },
  pune: { lat: 18.52, lon: 73.86, display: "Pune" },
  mumbai: { lat: 19.07, lon: 72.88, display: "Mumbai" },
  nagpur: { lat: 21.15, lon: 79.09, display: "Nagpur" },
  aurangabad: { lat: 19.88, lon: 75.34, display: "Aurangabad" },
  latur: { lat: 18.4, lon: 76.56, display: "Latur" },
  kolhapur: { lat: 16.7, lon: 74.24, display: "Kolhapur" },
  solapur: { lat: 17.68, lon: 75.9, display: "Solapur" },
  akola: { lat: 20.71, lon: 77.0, display: "Akola" },
  amravati: { lat: 20.93, lon: 77.75, display: "Amravati" },
  jalgaon: { lat: 21.0, lon: 75.56, display: "Jalgaon" },
  ahmednagar: { lat: 19.09, lon: 74.74, display: "Ahmednagar" },
  satara: { lat: 17.69, lon: 74.0, display: "Satara" },
  sangli: { lat: 16.86, lon: 74.57, display: "Sangli" },
  ratnagiri: { lat: 16.99, lon: 73.3, display: "Ratnagiri" },
  chandrapur: { lat: 19.96, lon: 79.3, display: "Chandrapur" },
  nanded: { lat: 19.15, lon: 77.32, display: "Nanded" },
  osmanabad: { lat: 18.18, lon: 76.04, display: "Osmanabad" },
  beed: { lat: 18.99, lon: 75.76, display: "Beed" },
  yavatmal: { lat: 20.39, lon: 78.12, display: "Yavatmal" },
};

// ── Crop risk matrix ──────────────────────────────────────────────────────────
// For each crop, defines thresholds that trigger specific risks.
// This is the agricultural intelligence layer of the weather module.
//
// Structure: { condition: threshold, riskPoints: N, message: "..." }
// Total risk points → risk level: 0-25=LOW, 26-50=MEDIUM, 51-75=HIGH, 76+=CRITICAL
const CROP_RISK_MATRIX = {
  onion: {
    name: "Onion",
    nameMr: "कांदा",
    nameHi: "प्याज",
    risks: [
      {
        condition: "rainfall",
        operator: ">",
        threshold: 15,
        points: 30,
        en: "Heavy rain can cause bulb rot and neck rot disease",
        mr: "जास्त पाऊस कांद्याला सड लावतो",
        hi: "अधिक बारिश से कांदे में सड़न होती है",
      },
      {
        condition: "humidity",
        operator: ">",
        threshold: 80,
        points: 20,
        en: "High humidity promotes purple blotch and thrips",
        mr: "जास्त आर्द्रतेमुळे जांभळा डाग रोग होतो",
        hi: "अधिक नमी से बैंगनी धब्बा रोग होता है",
      },
      {
        condition: "temperature",
        operator: ">",
        threshold: 38,
        points: 15,
        en: "Very high temperature stresses bulb development",
        mr: "जास्त तापमानामुळे कांद्याची वाढ थांबते",
        hi: "अधिक तापमान से कंद विकास रुकता है",
      },
      {
        condition: "windSpeed",
        operator: ">",
        threshold: 10,
        points: 10,
        en: "Strong winds can lodge plants and spread disease",
        mr: "जोरदार वारा रोग पसरवतो",
        hi: "तेज हवा से बीमारी फैलती है",
      },
      {
        condition: "temperature",
        operator: "<",
        threshold: 10,
        points: 25,
        en: "Low temperature below 10°C damages onion crop",
        mr: "१०°C पेक्षा कमी तापमान कांद्यास हानिकारक",
        hi: "10°C से कम तापमान फसल को नुकसान करता है",
      },
    ],
    generalAdvice: {
      en: "Ensure proper drainage. Avoid overhead irrigation during humid conditions.",
      mr: "योग्य निचरा ठेवा. दमट वातावरणात वरून पाणी देणे टाळा.",
      hi: "उचित जल निकासी सुनिश्चित करें। नम मौसम में ऊपर से सिंचाई न करें।",
    },
  },

  tomato: {
    name: "Tomato",
    nameMr: "टोमॅटो",
    nameHi: "टमाटर",
    risks: [
      {
        condition: "rainfall",
        operator: ">",
        threshold: 20,
        points: 25,
        en: "Heavy rain causes blossom drop and fruit cracking",
        mr: "जास्त पाऊस फुले गळतात आणि फळे फुटतात",
        hi: "भारी बारिश से फूल झड़ते और फल फटते हैं",
      },
      {
        condition: "humidity",
        operator: ">",
        threshold: 85,
        points: 30,
        en: "Very high humidity causes late blight (Phytophthora)",
        mr: "खूप जास्त आर्द्रता पाने जाळते",
        hi: "बहुत अधिक नमी से झुलसा रोग होता है",
      },
      {
        condition: "temperature",
        operator: ">",
        threshold: 35,
        points: 20,
        en: "High temperature causes flower drop and poor fruit set",
        mr: "जास्त तापमानात फुले गळतात",
        hi: "अधिक तापमान से फूल झड़ते हैं",
      },
      {
        condition: "temperature",
        operator: "<",
        threshold: 15,
        points: 15,
        en: "Cold temperatures slow growth and cause chilling injury",
        mr: "थंडीमुळे वाढ मंदावते",
        hi: "ठंड से वृद्धि धीमी होती है",
      },
    ],
    generalAdvice: {
      en: "Stake plants firmly. Apply copper fungicide before rainy spells.",
      mr: "झाडे बांधा. पावसाआधी तांब्याचे बुरशीनाशक फवारा.",
      hi: "पौधों को बांधें। बारिश से पहले कॉपर फफूंदनाशक का छिड़काव करें।",
    },
  },

  wheat: {
    name: "Wheat",
    nameMr: "गहू",
    nameHi: "गेहूँ",
    risks: [
      {
        condition: "temperature",
        operator: ">",
        threshold: 30,
        points: 35,
        en: "High temperature during grain filling causes shrivelled grains",
        mr: "दाणे भरताना जास्त तापमान दाणे आकुंचित करते",
        hi: "दाना भरते समय अधिक तापमान से दाने सिकुड़ते हैं",
      },
      {
        condition: "humidity",
        operator: ">",
        threshold: 75,
        points: 25,
        en: "High humidity promotes rust and powdery mildew",
        mr: "जास्त आर्द्रतेमुळे तांबेरा रोग होतो",
        hi: "अधिक नमी से रतुआ रोग होता है",
      },
      {
        condition: "rainfall",
        operator: ">",
        threshold: 10,
        points: 20,
        en: "Rain during flowering reduces pollination",
        mr: "फुलोऱ्यात पाऊस परागण कमी करतो",
        hi: "फूलने के समय बारिश परागण कम करती है",
      },
      {
        condition: "windSpeed",
        operator: ">",
        threshold: 8,
        points: 15,
        en: "Strong winds cause lodging in wheat",
        mr: "जोरदार वाऱ्याने गहू आडवा होतो",
        hi: "तेज हवा से गेहूं गिर जाता है",
      },
    ],
    generalAdvice: {
      en: "Monitor crop stage. Timely irrigation reduces heat stress.",
      mr: "पीक अवस्था तपासा. वेळेवर पाणी उष्णतेचा ताण कमी करते.",
      hi: "फसल की अवस्था देखें। समय पर सिंचाई से गर्मी का तनाव कम होता है।",
    },
  },

  soybean: {
    name: "Soybean",
    nameMr: "सोयाबीन",
    nameHi: "सोयाबीन",
    risks: [
      {
        condition: "rainfall",
        operator: ">",
        threshold: 30,
        points: 30,
        en: "Waterlogging kills soybean plants within 48 hours",
        mr: "जास्त पाण्यात सोयाबीन ४८ तासात मरते",
        hi: "जलभराव से 48 घंटे में सोयाबीन मर जाती है",
      },
      {
        condition: "humidity",
        operator: ">",
        threshold: 80,
        points: 20,
        en: "High humidity causes yellow mosaic virus spread",
        mr: "जास्त आर्द्रतेमुळे पिवळा मोझेक विषाणू पसरतो",
        hi: "अधिक नमी से पीला मोजेक वायरस फैलता है",
      },
      {
        condition: "temperature",
        operator: "<",
        threshold: 15,
        points: 25,
        en: "Cold temperatures below 15°C delay germination",
        mr: "१५°C पेक्षा थंडीत उगवण लांबते",
        hi: "15°C से कम ठंड में अंकुरण में देरी होती है",
      },
    ],
    generalAdvice: {
      en: "Ensure field drainage before sowing. Treat seeds with Rhizobium.",
      mr: "पेरणीपूर्वी शेत निचरा ठेवा. बियाण्यास रायझोबियम लावा.",
      hi: "बुवाई से पहले खेत में जल निकासी सुनिश्चित करें।",
    },
  },

  cotton: {
    name: "Cotton",
    nameMr: "कापूस",
    nameHi: "कपास",
    risks: [
      {
        condition: "rainfall",
        operator: ">",
        threshold: 25,
        points: 20,
        en: "Heavy rain causes boll shedding and boll rot",
        mr: "जास्त पाऊस बोंड गळतो",
        hi: "भारी बारिश से टिंडे झड़ते हैं",
      },
      {
        condition: "humidity",
        operator: ">",
        threshold: 80,
        points: 25,
        en: "High humidity promotes grey mildew and boll weevil",
        mr: "जास्त आर्द्रतेमुळे करपा रोग व बोंड अळी वाढते",
        hi: "अधिक नमी से ग्रे मिल्ड्यू और बॉल वीविल बढ़ता है",
      },
      {
        condition: "temperature",
        operator: ">",
        threshold: 40,
        points: 30,
        en: "Extreme heat above 40°C causes flower drop",
        mr: "४०°C पेक्षा जास्त तापमानात फुले गळतात",
        hi: "40°C से अधिक तापमान पर फूल झड़ते हैं",
      },
    ],
    generalAdvice: {
      en: "Monitor for bollworm after rain. Avoid pesticide spray during flowering.",
      mr: "पावसानंतर बोंड अळी तपासा. फुलोऱ्यात कीटकनाशक फवारू नका.",
      hi: "बारिश के बाद बॉलवर्म की जांच करें।",
    },
  },

  rice: {
    name: "Rice",
    nameMr: "तांदूळ",
    nameHi: "चावल",
    risks: [
      {
        condition: "temperature",
        operator: ">",
        threshold: 35,
        points: 30,
        en: "High temperature during flowering causes spikelet sterility",
        mr: "फुलोऱ्यात जास्त तापमान दाणे पोकळ करते",
        hi: "फूलने के दौरान अधिक तापमान से दाने खोखले होते हैं",
      },
      {
        condition: "windSpeed",
        operator: ">",
        threshold: 12,
        points: 20,
        en: "Strong winds cause lodging and neck blast spread",
        mr: "जोरदार वाऱ्याने भात आडवा होतो",
        hi: "तेज हवा से धान गिर जाता है",
      },
      {
        condition: "rainfall",
        operator: "<",
        threshold: 5,
        points: 15,
        en: "Insufficient water stresses rice at critical stages",
        mr: "कमी पाण्यात भात कमकुवत होतो",
        hi: "पर्याप्त पानी न होने से फसल कमजोर होती है",
      },
    ],
    generalAdvice: {
      en: "Maintain 2–5 cm water level in field. Watch for blast disease after cool nights.",
      mr: "शेतात २-५ सेमी पाणी ठेवा. थंड रात्रीनंतर करपा तपासा.",
      hi: "खेत में 2-5 सेमी पानी बनाए रखें।",
    },
  },
};

// ── Risk scoring engine ───────────────────────────────────────────────────────
/**
 * Calculates risk score for a crop given current weather conditions.
 * Returns { riskLevel, riskScore, risks[], advice }
 */
const scoreCropRisk = (cropId, weatherData, lang = "en") => {
  const cropMatrix = CROP_RISK_MATRIX[cropId.toLowerCase()];
  if (!cropMatrix) return null;

  let totalPoints = 0;
  const triggeredRisks = [];

  for (const risk of cropMatrix.risks) {
    const actual = weatherData[risk.condition];
    if (actual === undefined || actual === null) continue;

    let triggered = false;
    if (risk.operator === ">" && actual > risk.threshold) triggered = true;
    if (risk.operator === ">=" && actual >= risk.threshold) triggered = true;
    if (risk.operator === "<" && actual < risk.threshold) triggered = true;
    if (risk.operator === "<=" && actual <= risk.threshold) triggered = true;

    if (triggered) {
      totalPoints += risk.points;
      triggeredRisks.push(risk[lang] || risk.en);
    }
  }

  // Clamp to 0-100
  const riskScore = Math.min(totalPoints, 100);

  let riskLevel;
  if (riskScore >= 76) riskLevel = "CRITICAL";
  else if (riskScore >= 51) riskLevel = "HIGH";
  else if (riskScore >= 26) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  return {
    crop: cropId,
    cropName: cropMatrix.name,
    cropNameMr: cropMatrix.nameMr,
    cropNameHi: cropMatrix.nameHi,
    riskLevel,
    riskScore,
    risks: triggeredRisks,
    advice: cropMatrix.generalAdvice[lang] || cropMatrix.generalAdvice.en,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTED SERVICE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET CURRENT WEATHER + CROP RISK
 * Main function called by the weather controller.
 *
 * @param {string}   district   - e.g. "nashik"
 * @param {string[]} crops      - e.g. ["onion", "wheat"]
 * @param {string}   lang       - "mr" | "hi" | "en"
 */
const getWeatherAndRisk = async (district, crops = [], lang = "en") => {
  const districtLower = district.toLowerCase().trim();

  // ── Check Redis cache ──────────────────────────────────────
  const cacheKey = `weather:${districtLower}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    logger.info(`Cache HIT: ${cacheKey}`);
    // Re-score for requested crops in requested language (fast, no API call)
    const cropRisks = crops.length
      ? crops.map((c) => scoreCropRisk(c, cached.current, lang)).filter(Boolean)
      : [];
    return { ...cached, cropRisks, fromCache: true };
  }

  // ── Get coordinates ────────────────────────────────────────
  const coords = DISTRICT_COORDS[districtLower];
  if (!coords) {
    throw new AppError(
      `District "${district}" not supported yet. Supported: ${Object.keys(DISTRICT_COORDS).join(", ")}`,
      400,
      "ERR_WTH_001",
    );
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "OPENWEATHER_API_KEY not configured. Add it to your .env file.",
      503,
      "ERR_WTH_002",
    );
  }

  // ── Fetch current weather from OpenWeatherMap ──────────────
  let currentWeather, forecastData;
  try {
    const [currentRes, forecastRes] = await Promise.all([
      axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: {
          lat: coords.lat,
          lon: coords.lon,
          appid: apiKey,
          units: "metric",
        },
        timeout: 8000,
      }),
      axios.get("https://api.openweathermap.org/data/2.5/forecast", {
        params: {
          lat: coords.lat,
          lon: coords.lon,
          appid: apiKey,
          units: "metric",
          cnt: 40,
        },
        timeout: 8000,
      }),
    ]);
    currentWeather = currentRes.data;
    forecastData = forecastRes.data;
  } catch (err) {
    // OpenWeatherMap down — try to return last stored weather
    const lastLog = await WeatherLog.findOne(
      { district: districtLower },
      null,
      { sort: { fetchedAt: -1 } },
    );
    if (lastLog) {
      logger.warn(
        `OpenWeatherMap failed (${err.message}) — using last stored data`,
      );
      return {
        district: lastLog.district,
        displayName: coords.display,
        current: lastLog,
        cropRisks: [],
        fromCache: false,
        stale: true,
        note: "Live weather unavailable — showing last stored data.",
      };
    }
    throw new AppError(
      `Weather API unavailable: ${err.message}`,
      503,
      "ERR_WTH_003",
    );
  }

  // ── Parse current conditions ───────────────────────────────
  const current = {
    temperature: currentWeather.main.temp,
    feelsLike: currentWeather.main.feels_like,
    humidity: currentWeather.main.humidity,
    pressure: currentWeather.main.pressure,
    windSpeed: currentWeather.wind.speed,
    windDeg: currentWeather.wind.deg,
    cloudCover: currentWeather.clouds.all,
    visibility: currentWeather.visibility,
    rainfall: currentWeather.rain?.["1h"] || 0,
    condition: currentWeather.weather[0].main,
    description: currentWeather.weather[0].description,
    icon: currentWeather.weather[0].icon,
  };

  // ── Parse 5-day forecast ───────────────────────────────────
  // OpenWeatherMap returns forecasts every 3 hours. We pick noon each day.
  const forecastByDay = {};
  for (const item of forecastData.list) {
    const date = new Date(item.dt * 1000);
    const dateStr = date.toISOString().split("T")[0];
    const hour = date.getUTCHours();
    // Pick the 12:00 UTC entry for each day
    if (hour === 12 || !forecastByDay[dateStr]) {
      forecastByDay[dateStr] = {
        date: date,
        tempMin: item.main.temp_min,
        tempMax: item.main.temp_max,
        humidity: item.main.humidity,
        rainfall: item.rain?.["3h"] || 0,
        condition: item.weather[0].main,
        description: item.weather[0].description,
        windSpeed: item.wind.speed,
      };
    }
  }
  const forecast = Object.values(forecastByDay).slice(0, 5);

  // ── Score crop risks ───────────────────────────────────────
  const cropRisks = crops.length
    ? crops.map((c) => scoreCropRisk(c, current, lang)).filter(Boolean)
    : [];

  // ── Build result ───────────────────────────────────────────
  const result = {
    district: districtLower,
    displayName: coords.display,
    lat: coords.lat,
    lon: coords.lon,
    current,
    forecast,
    cropRisks,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };

  // ── Save to MongoDB ────────────────────────────────────────
  try {
    const riskScoresToStore = crops
      .map((c) => {
        const score = scoreCropRisk(c, current, "en");
        return score
          ? {
              ...score,
              adviceMr: CROP_RISK_MATRIX[c]?.generalAdvice?.mr,
              adviceHi: CROP_RISK_MATRIX[c]?.generalAdvice?.hi,
            }
          : null;
      })
      .filter(Boolean);

    await WeatherLog.create({
      district: districtLower,
      state: "Maharashtra",
      lat: coords.lat,
      lon: coords.lon,
      ...current,
      forecast,
      riskScores: riskScoresToStore,
      fetchedAt: new Date(),
    });
  } catch (dbErr) {
    logger.warn(`Failed to save weather log: ${dbErr.message}`);
  }

  // ── Cache in Redis ─────────────────────────────────────────
  await redis.set(
    cacheKey,
    {
      district: districtLower,
      displayName: coords.display,
      lat: coords.lat,
      lon: coords.lon,
      current,
      forecast,
      fetchedAt: result.fetchedAt,
    },
    CACHE_TTL,
  );

  return result;
};

/**
 * GET 5-DAY FORECAST ONLY
 * Lighter endpoint for the app's forecast screen.
 */
const getForecast = async (district) => {
  const data = await getWeatherAndRisk(district, []);
  return {
    district: data.displayName,
    forecast: data.forecast,
    fetchedAt: data.fetchedAt,
    fromCache: data.fromCache,
  };
};

/**
 * GET SUPPORTED DISTRICTS
 * Returns the list of districts we support with their coordinates.
 */
const getSupportedDistricts = async () => {
  return Object.entries(DISTRICT_COORDS).map(([id, d]) => ({
    id,
    name: d.display,
    lat: d.lat,
    lon: d.lon,
  }));
};

/**
 * CHECK WEATHER RISK FOR ALL FARMERS IN A DISTRICT
 * Called by the daily cron job. Fetches weather once per district
 * then sends alerts to all farmers growing HIGH/CRITICAL risk crops.
 */
const checkAndAlertFarmers = async (district) => {
  try {
    // Get all unique crops grown by farmers in this district
    const farmers = await User.find({
      district: { $regex: district, $options: "i" },
      isVerified: true,
      isActive: true,
      primaryCrops: { $exists: true, $ne: [] },
    }).select("_id primaryCrops languagePreference");

    if (!farmers.length) return;

    // Collect unique crops across all farmers in this district
    const uniqueCrops = [...new Set(farmers.flatMap((f) => f.primaryCrops))];

    // Fetch weather + compute risks for all crops
    const weatherData = await getWeatherAndRisk(district, uniqueCrops, "en");

    // For each farmer, check if any of their crops are HIGH/CRITICAL risk
    for (const farmer of farmers) {
      const farmerRisks = weatherData.cropRisks.filter(
        (r) =>
          farmer.primaryCrops.includes(r.crop) &&
          (r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL"),
      );

      for (const risk of farmerRisks) {
        await notificationService.sendWeatherAlert(
          farmer._id,
          risk.riskLevel,
          risk.cropName,
        );
        logger.info(
          `Weather alert sent: farmer ${farmer._id} | ${risk.crop} | ${risk.riskLevel}`,
        );
      }
    }
  } catch (err) {
    logger.error(`checkAndAlertFarmers failed for ${district}: ${err.message}`);
  }
};

module.exports = {
  getWeatherAndRisk,
  getForecast,
  getSupportedDistricts,
  checkAndAlertFarmers,
  DISTRICT_COORDS,
  CROP_RISK_MATRIX,
  scoreCropRisk,
};
