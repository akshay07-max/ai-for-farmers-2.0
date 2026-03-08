const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { protect, restrictTo } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { sendSuccess, sendError } = require("../../utils/response");
const User = require("../../models/User");

// Schema for profile update — all fields optional, only update what's sent
const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  village: z.string().trim().optional(),
  district: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter valid 6-digit pincode")
    .optional(),
  languagePreference: z.enum(["mr", "hi", "en"]).optional(),
  primaryCrops: z.array(z.string()).optional(),
  farmSizeAcres: z.number().min(0).optional(),
  fcmToken: z.string().optional(),
});

/**
 * GET /api/v1/users/me
 * Returns the logged-in user's profile.
 * req.user is already loaded by the protect middleware — no extra DB call.
 */
router.get("/me", protect, (req, res) => {
  sendSuccess(res, 200, "Profile fetched successfully.", {
    user: req.user.toSafeObject(),
  });
});

/**
 * PUT /api/v1/users/me
 * Update the logged-in user's profile.
 * Only the fields you send get updated — everything else stays the same.
 */
router.put(
  "/me",
  protect,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: req.body },
        { new: true, runValidators: true },
      );
      sendSuccess(res, 200, "Profile updated successfully.", {
        user: updatedUser.toSafeObject(),
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
