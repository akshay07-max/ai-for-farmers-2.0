// ================================================================
// CATTLE SERVICE — all business logic
// ================================================================
const crypto = require("crypto");
const Cattle = require("../../models/Cattle");
const HealthLog = require("../../models/HealthLog");
const Vaccination = require("../../models/Vaccination");
const notificationService = require("../../services/notificationService");
const { AppError } = require("../../middlewares/errorHandler");
const logger = require("../../utils/logger");

// ── Disease suggestion engine ─────────────────────────────────────────────────
// Maps symptom combinations → probable diseases
// Simple rule-based system — replace with ML model in Step 13
const DISEASE_RULES = [
  {
    disease: "Foot and Mouth Disease (FMD)",
    diseaseMr: "पाय-तोंड रोग",
    symptoms: ["MOUTH_LESIONS", "LAMENESS", "FEVER", "LOSS_OF_APPETITE"],
    minMatch: 3,
    severity: "CRITICAL",
    action:
      "Isolate animal immediately. Contact vet. Report to animal husbandry dept.",
    actionMr:
      "जनावर लगेच वेगळे करा. पशुवैद्याला बोलवा. पशुसंवर्धन विभागाला कळवा.",
  },
  {
    disease: "Mastitis",
    diseaseMr: "कासदाह",
    symptoms: ["UDDER_SWELLING", "REDUCED_MILK", "FEVER"],
    minMatch: 2,
    severity: "HIGH",
    action:
      "Check milk for clots. Apply warm compress. Consult vet for antibiotic.",
    actionMr:
      "दुधात गाठी तपासा. उबदार शेक द्या. प्रतिजैविकासाठी पशुवैद्याला भेटा.",
  },
  {
    disease: "Bloat (Tympany)",
    diseaseMr: "अफरा रोग",
    symptoms: ["BLOATING", "LOSS_OF_APPETITE", "ABNORMAL_BREATHING"],
    minMatch: 2,
    severity: "HIGH",
    action:
      "Walk the animal. Massage left flank. Contact vet immediately if severe.",
    actionMr:
      "जनावराला चालवा. डाव्या कुशीवर मालिश करा. गंभीर असल्यास पशुवैद्याला बोलवा.",
  },
  {
    disease: "Hemorrhagic Septicemia (HS)",
    diseaseMr: "घटसर्प",
    symptoms: ["FEVER", "NASAL_DISCHARGE", "ABNORMAL_BREATHING", "LETHARGY"],
    minMatch: 3,
    severity: "CRITICAL",
    action: "Emergency — call vet NOW. Isolate from other animals.",
    actionMr:
      "आपत्कालीन — आत्ता पशुवैद्याला बोलवा. इतर जनावरांपासून वेगळे करा.",
  },
  {
    disease: "Tick Fever (Theileria)",
    diseaseMr: "गोचीड ताप",
    symptoms: ["FEVER", "LETHARGY", "LOSS_OF_APPETITE", "EYE_DISCHARGE"],
    minMatch: 3,
    severity: "HIGH",
    action:
      "Check for ticks. Apply tick treatment. Consult vet for Buparvaquone injection.",
    actionMr:
      "गोचीड तपासा. गोचीड उपचार करा. Buparvaquone इंजेक्शनसाठी पशुवैद्याला भेटा.",
  },
  {
    disease: "Pneumonia",
    diseaseMr: "न्यूमोनिया",
    symptoms: ["COUGH", "NASAL_DISCHARGE", "FEVER", "ABNORMAL_BREATHING"],
    minMatch: 3,
    severity: "HIGH",
    action: "Keep animal in dry, warm shelter. Contact vet for antibiotics.",
    actionMr:
      "जनावराला कोरड्या, उबदार जागी ठेवा. प्रतिजैविकासाठी पशुवैद्याला भेटा.",
  },
  {
    disease: "Diarrhea / Scours",
    diseaseMr: "जुलाब",
    symptoms: ["DIARRHEA", "LETHARGY", "LOSS_OF_APPETITE"],
    minMatch: 2,
    severity: "MEDIUM",
    action:
      "Provide ORS (oral rehydration). Withhold feed 12hrs. Consult vet if >24hrs.",
    actionMr:
      "ORS द्या. १२ तास चारा बंद करा. २४ तासांहून जास्त असल्यास पशुवैद्याला भेटा.",
  },
];

/**
 * Suggest probable disease based on symptoms
 */
const suggestDisease = (symptoms) => {
  if (!symptoms || symptoms.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const rule of DISEASE_RULES) {
    const matchCount = rule.symptoms.filter((s) => symptoms.includes(s)).length;
    if (matchCount >= rule.minMatch && matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = { ...rule, matchCount };
    }
  }
  return bestMatch;
};

/**
 * Run anomaly detection on a health log reading
 * Compares against animal's personal baseline
 */
const detectAnomalies = (log, baseline) => {
  const flags = [];
  let riskScore = 0;

  // Temperature anomalies
  if (log.temperature) {
    if (log.temperature > 40.0) {
      flags.push("Critical fever (>40°C)");
      riskScore += 40;
    } else if (log.temperature > 39.5) {
      flags.push("High temperature (>39.5°C)");
      riskScore += 25;
    } else if (log.temperature < 37.5) {
      flags.push("Low temperature (<37.5°C)");
      riskScore += 20;
    }

    // Compare to this animal's baseline
    if (baseline?.avgTemperature) {
      const diff = log.temperature - baseline.avgTemperature;
      if (diff > 1.5) {
        flags.push(`Temp ${diff.toFixed(1)}°C above personal baseline`);
        riskScore += 15;
      }
    }
  }

  // Milk drop anomaly
  if (log.milkTotal && baseline?.avgMilkYield && baseline.avgMilkYield > 0) {
    const dropPct =
      ((baseline.avgMilkYield - log.milkTotal) / baseline.avgMilkYield) * 100;
    if (dropPct > 30) {
      flags.push(`Milk dropped ${dropPct.toFixed(0)}% from baseline`);
      riskScore += 30;
    } else if (dropPct > 15) {
      flags.push(`Milk dropped ${dropPct.toFixed(0)}% from baseline`);
      riskScore += 15;
    }
  }

  // Behavioral flags
  if (log.appetite === "NOT_EATING") {
    flags.push("Not eating");
    riskScore += 20;
  }
  if (log.appetite === "REDUCED") {
    flags.push("Reduced appetite");
    riskScore += 10;
  }
  if (log.activity === "LETHARGIC") {
    flags.push("Lethargy");
    riskScore += 15;
  }
  if (log.rumination === "ABSENT") {
    flags.push("No rumination");
    riskScore += 20;
  }
  if (log.rumination === "REDUCED") {
    flags.push("Reduced rumination");
    riskScore += 10;
  }

  // Symptom count
  if (log.symptoms?.length >= 3) {
    flags.push(`Multiple symptoms: ${log.symptoms.length}`);
    riskScore += 20;
  } else if (log.symptoms?.length >= 1) {
    riskScore += 10;
  }

  // Combined signals (more dangerous together)
  if (log.temperature > 39.5 && log.appetite === "NOT_EATING") {
    flags.push("Fever + not eating (high disease risk)");
    riskScore += 15;
  }

  riskScore = Math.min(riskScore, 100);

  let riskLevel;
  if (riskScore >= 70) riskLevel = "CRITICAL";
  else if (riskScore >= 45) riskLevel = "HIGH";
  else if (riskScore >= 20) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  const diseaseSuggestion = suggestDisease(log.symptoms);

  return {
    detected: riskScore >= 20,
    riskLevel,
    riskScore,
    flags,
    suggestion: diseaseSuggestion?.action || null,
  };
};

// ── CATTLE CRUD ───────────────────────────────────────────────────────────────

const addCattle = async (ownerId, data) => {
  // Auto-calculate expected calving if pregnancy date provided
  if (data.pregnancyDate && !data.expectedCalving) {
    const calving = new Date(data.pregnancyDate);
    calving.setDate(calving.getDate() + 280); // gestation ~280 days
    data.expectedCalving = calving;
  }

  // Auto-predict next heat date if last heat provided
  if (data.lastHeatDate && !data.nextHeatDate) {
    const nextHeat = new Date(data.lastHeatDate);
    nextHeat.setDate(nextHeat.getDate() + 21); // estrus cycle 21 days
    data.nextHeatDate = nextHeat;
  }

  const cattle = await Cattle.create({ ownerId, ...data });
  logger.info(`Cattle added: ${cattle.name} for owner ${ownerId}`);
  return cattle;
};

const getMyCattle = async (ownerId) => {
  return Cattle.find({ ownerId, isActive: true }).sort({ name: 1 });
};

const getCattleById = async (ownerId, cattleId) => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");
  return cattle;
};

const updateCattle = async (ownerId, cattleId, data) => {
  // Recalculate dates if relevant fields updated
  if (data.pregnancyDate) {
    const calving = new Date(data.pregnancyDate);
    calving.setDate(calving.getDate() + 280);
    data.expectedCalving = calving;
  }
  if (data.lastHeatDate) {
    const nextHeat = new Date(data.lastHeatDate);
    nextHeat.setDate(nextHeat.getDate() + 21);
    data.nextHeatDate = nextHeat;
  }

  const cattle = await Cattle.findOneAndUpdate(
    { _id: cattleId, ownerId },
    { $set: data },
    { new: true, runValidators: true },
  );
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");
  return cattle;
};

const removeCattle = async (ownerId, cattleId) => {
  const cattle = await Cattle.findOneAndUpdate(
    { _id: cattleId, ownerId },
    { isActive: false },
    { new: true },
  );
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");
  return { deleted: true };
};

// ── HEALTH LOGS ───────────────────────────────────────────────────────────────

const addHealthLog = async (ownerId, cattleId, data, source = "MANUAL") => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");

  // Detect anomalies
  const anomaly = detectAnomalies(data, cattle.baseline);

  const log = await HealthLog.create({
    cattleId,
    ownerId,
    ...data,
    source,
    anomaly,
  });

  // Update baseline (rolling average over last 14 readings)
  await updateBaseline(cattle, log);

  // Send alert if HIGH or CRITICAL
  if (anomaly.riskLevel === "HIGH" || anomaly.riskLevel === "CRITICAL") {
    await notificationService.sendCattleHealthAlert(
      ownerId,
      cattle.name,
      anomaly.flags.slice(0, 2).join(", "),
    );
    logger.info(`Cattle alert sent: ${cattle.name} | ${anomaly.riskLevel}`);
  }

  return { log, anomaly };
};

/**
 * Update cattle's health baseline from last 14 readings
 */
const updateBaseline = async (cattle, newLog) => {
  const recentLogs = await HealthLog.find({ cattleId: cattle._id })
    .sort({ recordedAt: -1 })
    .limit(14)
    .select("temperature milkTotal activityScore");

  const temps = recentLogs.map((l) => l.temperature).filter(Boolean);
  const milks = recentLogs.map((l) => l.milkTotal).filter(Boolean);
  const acts = recentLogs.map((l) => l.activityScore).filter(Boolean);

  const avg = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  await Cattle.findByIdAndUpdate(cattle._id, {
    baseline: {
      avgTemperature: avg(temps),
      avgMilkYield: avg(milks),
      avgActivityScore: avg(acts),
      calculatedAt: new Date(),
      sampleCount: recentLogs.length,
    },
  });
};

const getHealthHistory = async (ownerId, cattleId, days = 30) => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await HealthLog.find({
    cattleId,
    recordedAt: { $gte: since },
  }).sort({ recordedAt: -1 });

  return { cattle, logs };
};

// ── MILK PRODUCTION ───────────────────────────────────────────────────────────

const getMilkStats = async (ownerId, cattleId, days = 30) => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await HealthLog.find({
    cattleId,
    milkTotal: { $exists: true, $gt: 0 },
    recordedAt: { $gte: since },
  })
    .sort({ recordedAt: 1 })
    .select("milkMorning milkEvening milkTotal recordedAt");

  const totalLitres = logs.reduce((s, l) => s + (l.milkTotal || 0), 0);
  const avgPerDay = logs.length ? totalLitres / logs.length : 0;
  const peak = logs.reduce((m, l) => (l.milkTotal > m ? l.milkTotal : m), 0);

  return {
    cattle: { id: cattle._id, name: cattle.name },
    period: `${days} days`,
    totalLitres: Math.round(totalLitres * 10) / 10,
    avgPerDay: Math.round(avgPerDay * 10) / 10,
    peakYield: peak,
    baseline: cattle.baseline?.avgMilkYield,
    logs,
  };
};

// ── VACCINATIONS ──────────────────────────────────────────────────────────────

const addVaccination = async (ownerId, cattleId, data) => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");

  // Auto-calculate next due date from schedule
  const schedule =
    Vaccination.schema.statics.SCHEDULE ||
    require("../../models/Vaccination").SCHEDULE;
  if (!data.nextDueDate && data.vaccineName) {
    const key = Object.keys(Vaccination.SCHEDULE || {}).find((k) =>
      data.vaccineName.toUpperCase().includes(k),
    );
    if (key && Vaccination.SCHEDULE[key]?.intervalDays) {
      const nextDue = new Date(data.givenDate);
      nextDue.setDate(
        nextDue.getDate() + Vaccination.SCHEDULE[key].intervalDays,
      );
      data.nextDueDate = nextDue;
    }
  }

  const vacc = await Vaccination.create({ cattleId, ownerId, ...data });
  return vacc;
};

const getVaccinations = async (ownerId, cattleId) => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");

  const vaccs = await Vaccination.find({ cattleId }).sort({ givenDate: -1 });

  // Find upcoming dues within 30 days
  const upcoming = vaccs.filter((v) => {
    if (!v.nextDueDate) return false;
    const daysUntil = (v.nextDueDate - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 30;
  });

  return { cattle, vaccinations: vaccs, upcoming };
};

// ── IOT DEVICE ────────────────────────────────────────────────────────────────

/**
 * Register a SmartTag device to a cattle animal.
 * Generates a unique device token stored in the cattle record.
 * Farmer gets this token to flash into the device firmware.
 */
const registerIoTDevice = async (ownerId, cattleId, deviceId) => {
  const cattle = await Cattle.findOne({ _id: cattleId, ownerId });
  if (!cattle) throw new AppError("Cattle not found.", 404, "ERR_CTL_001");

  // Generate a secure random token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const displayToken = `km_dev_${rawToken}`;

  await Cattle.findByIdAndUpdate(cattleId, {
    "iotDevice.deviceId": deviceId,
    "iotDevice.deviceToken": tokenHash, // stored as hash
    "iotDevice.isActive": true,
  });

  logger.info(`IoT device registered: ${deviceId} → cattle ${cattle.name}`);

  return {
    cattleName: cattle.name,
    deviceId,
    // Return the RAW token ONCE — farmer flashes this into firmware
    // We only store the hash — if lost, must regenerate
    deviceToken: displayToken,
    instructions:
      "Flash this token into your ESP32 firmware as DEVICE_TOKEN. Keep it secret.",
  };
};

/**
 * Ingest a reading from an IoT SmartTag device.
 * Called by the hardware every 30–60 minutes.
 * Authenticated by device token (not user JWT).
 */
const ingestIoTReading = async (deviceToken, data) => {
  // Find cattle by hashed device token
  const tokenHash = crypto
    .createHash("sha256")
    .update(deviceToken)
    .digest("hex");
  const cattle = await Cattle.findOne({
    "iotDevice.deviceToken": tokenHash,
    "iotDevice.isActive": true,
  });

  if (!cattle) {
    throw new AppError("Invalid device token.", 401, "ERR_IOT_001");
  }

  // Update device last seen + battery
  await Cattle.findByIdAndUpdate(cattle._id, {
    "iotDevice.lastSeenAt": new Date(),
    "iotDevice.batteryLevel": data.battery || null,
  });

  // Store the reading as a health log
  const { log, anomaly } = await addHealthLog(
    cattle.ownerId,
    cattle._id,
    {
      temperature: data.temperature,
      heartRate: data.heartRate,
      activityScore: data.activity,
      location: data.gps ? { lat: data.gps.lat, lon: data.gps.lon } : undefined,
    },
    "IOT",
  );

  return { received: true, cattleId: cattle._id, anomaly };
};

module.exports = {
  addCattle,
  getMyCattle,
  getCattleById,
  updateCattle,
  removeCattle,
  addHealthLog,
  getHealthHistory,
  getMilkStats,
  addVaccination,
  getVaccinations,
  registerIoTDevice,
  ingestIoTReading,
  detectAnomalies,
  suggestDisease,
};
