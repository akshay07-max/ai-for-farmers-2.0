// ================================================================
// ADMIN AUTH MIDDLEWARE
// Uses a SEPARATE JWT secret (ADMIN_JWT_SECRET) from farmer tokens.
// Even if a farmer's token is compromised, admin routes are safe.
// ================================================================
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { AppError } = require("./errorHandler");

const adminAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(
        "Admin authentication required.",
        401,
        "ERR_ADM_AUTH_001",
      );
    }

    const token = header.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    } catch {
      throw new AppError(
        "Invalid or expired admin token.",
        401,
        "ERR_ADM_AUTH_002",
      );
    }

    // Must have admin type claim — farmer tokens are rejected here
    if (decoded.type !== "ADMIN") {
      throw new AppError(
        "This token is not an admin token.",
        403,
        "ERR_ADM_AUTH_003",
      );
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin || !admin.isActive) {
      throw new AppError(
        "Admin account not found or deactivated.",
        401,
        "ERR_ADM_AUTH_004",
      );
    }

    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
};

// Permission check middleware factory
// Usage: requirePermission("manageUsers")
const requirePermission = (permission) => (req, res, next) => {
  if (req.admin.role === "SUPER_ADMIN") return next(); // super admin bypasses all
  if (!req.admin.permissions[permission]) {
    return next(
      new AppError(
        `You don't have '${permission}' permission.`,
        403,
        "ERR_ADM_PERM_001",
      ),
    );
  }
  next();
};

module.exports = { adminAuth, requirePermission };
