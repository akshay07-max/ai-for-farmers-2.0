// node src/scripts/seed_admin.js
// ================================================================
// SEED ADMIN — creates the first super admin account
// Run ONCE after setup. Never run again (checks for existing admin).
// Usage: node src/scripts/seed_admin.js
// ================================================================
require("dotenv").config();
const mongoose  = require("mongoose");
const connectDB = require("../config/db");
const Admin     = require("../models/Admin");

const seed = async () => {
  try {
    await connectDB();

    const existing = await Admin.findOne({ role: "SUPER_ADMIN" });
    if (existing) {
      console.log("⏭️  Super admin already exists:", existing.email);
      console.log("   To reset, manually delete from MongoDB and run again.");
      return;
    }

    // Read from env or use defaults (CHANGE THESE before production)
    const email    = process.env.ADMIN_EMAIL    || "admin@krishimitra.in";
    const password = process.env.ADMIN_PASSWORD || "Admin@2026!";
    const name     = process.env.ADMIN_NAME     || "KrishiMitra Admin";

    const admin = await Admin.create({
      name,
      email,
      password,   // gets hashed by pre-save hook
      role:       "SUPER_ADMIN",
      permissions:{
        manageUsers:         true,
        manageContent:       true,
        manageNotifications: true,
        viewAnalytics:       true,
        manageAdmins:        true,
      },
    });

    console.log("=".repeat(50));
    console.log("  ✅ Super Admin created!");
    console.log(`  📧 Email:    ${email}`);
    console.log(`  🔑 Password: ${password}`);
    console.log("  ⚠️  Change this password immediately after first login!");
    console.log("=".repeat(50));

  } catch (err) {
    console.error("Seed failed:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();