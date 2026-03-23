// ================================================================
// CATTLE CONTROLLER
// ================================================================
const cattleService = require("./cattle.service");
const { sendSuccess, sendError } = require("../../utils/response");

// ── Cattle CRUD ───────────────────────────────────────────────

async function addCattle(req, res, next) {
  try {
    const cattle = await cattleService.addCattle(req.user._id, req.body);
    sendSuccess(res, 201, "Cattle added successfully.", { cattle });
  } catch (err) {
    next(err);
  }
}

async function getMyCattle(req, res, next) {
  try {
    const cattle = await cattleService.getMyCattle(req.user._id);
    sendSuccess(res, 200, `${cattle.length} cattle found.`, { cattle });
  } catch (err) {
    next(err);
  }
}

async function getCattle(req, res, next) {
  try {
    const cattle = await cattleService.getCattleById(
      req.user._id,
      req.params.cattleId,
    );
    sendSuccess(res, 200, "Cattle fetched.", { cattle });
  } catch (err) {
    next(err);
  }
}

async function updateCattle(req, res, next) {
  try {
    const cattle = await cattleService.updateCattle(
      req.user._id,
      req.params.cattleId,
      req.body,
    );
    sendSuccess(res, 200, "Cattle updated.", { cattle });
  } catch (err) {
    next(err);
  }
}

async function removeCattle(req, res, next) {
  try {
    await cattleService.removeCattle(req.user._id, req.params.cattleId);
    sendSuccess(res, 200, "Cattle removed.", null);
  } catch (err) {
    next(err);
  }
}

// ── Health logs ───────────────────────────────────────────────

async function addHealthLog(req, res, next) {
  try {
    const { log, anomaly } = await cattleService.addHealthLog(
      req.user._id,
      req.params.cattleId,
      req.body,
    );
    const message =
      anomaly.riskLevel === "LOW"
        ? "Health log saved. All looks normal."
        : `Health log saved. ${anomaly.riskLevel} risk detected — check alerts.`;
    sendSuccess(res, 201, message, { log, anomaly });
  } catch (err) {
    next(err);
  }
}

async function getHealthHistory(req, res, next) {
  try {
    const { days = 30 } = req.query;
    const data = await cattleService.getHealthHistory(
      req.user._id,
      req.params.cattleId,
      parseInt(days),
    );
    sendSuccess(res, 200, "Health history fetched.", data);
  } catch (err) {
    next(err);
  }
}

// ── Milk ─────────────────────────────────────────────────────

async function getMilkStats(req, res, next) {
  try {
    const { days = 30 } = req.query;
    const data = await cattleService.getMilkStats(
      req.user._id,
      req.params.cattleId,
      parseInt(days),
    );
    sendSuccess(res, 200, "Milk stats fetched.", { milk: data });
  } catch (err) {
    next(err);
  }
}

// ── Vaccinations ──────────────────────────────────────────────

async function addVaccination(req, res, next) {
  try {
    const vacc = await cattleService.addVaccination(
      req.user._id,
      req.params.cattleId,
      req.body,
    );
    sendSuccess(res, 201, "Vaccination recorded.", { vaccination: vacc });
  } catch (err) {
    next(err);
  }
}

async function getVaccinations(req, res, next) {
  try {
    const data = await cattleService.getVaccinations(
      req.user._id,
      req.params.cattleId,
    );
    sendSuccess(res, 200, "Vaccinations fetched.", data);
  } catch (err) {
    next(err);
  }
}

// ── IoT ───────────────────────────────────────────────────────

async function registerDevice(req, res, next) {
  try {
    const { deviceId } = req.body;
    if (!deviceId)
      return sendError(res, 400, "deviceId is required.", "ERR_VAL_001");
    const result = await cattleService.registerIoTDevice(
      req.user._id,
      req.params.cattleId,
      deviceId,
    );
    sendSuccess(res, 200, "IoT device registered.", { device: result });
  } catch (err) {
    next(err);
  }
}

async function iotReading(req, res, next) {
  try {
    // IoT devices authenticate with X-Device-Token header, not JWT
    const deviceToken = req.headers["x-device-token"];
    if (!deviceToken) {
      return sendError(
        res,
        401,
        "X-Device-Token header required.",
        "ERR_IOT_002",
      );
    }
    const result = await cattleService.ingestIoTReading(deviceToken, req.body);
    sendSuccess(res, 200, "Reading received.", result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  addCattle,
  getMyCattle,
  getCattle,
  updateCattle,
  removeCattle,
  addHealthLog,
  getHealthHistory,
  getMilkStats,
  addVaccination,
  getVaccinations,
  registerDevice,
  iotReading,
};
