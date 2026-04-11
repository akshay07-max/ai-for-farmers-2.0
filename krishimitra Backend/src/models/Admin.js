// ================================================================
// ADMIN MODEL
// Completely separate from User model.
// Admins have roles — SUPER_ADMIN can do everything,
// MODERATOR can manage content but not other admins.
// ================================================================
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "MODERATOR"],
      default: "MODERATOR",
    },

    // What this admin is allowed to do
    permissions: {
      manageUsers: { type: Boolean, default: true },
      manageContent: { type: Boolean, default: true },
      manageNotifications: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: true },
      manageAdmins: { type: Boolean, default: false }, // SUPER_ADMIN only
    },

    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

// Hash password before save
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("Admin", adminSchema);
