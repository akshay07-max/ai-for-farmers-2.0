// ================================================================
// AWS S3 CONFIG — Audio file storage
// Farmer's voice recordings + AI audio responses are stored here.
// In development, we skip S3 and return base64 audio directly.
// ================================================================
const logger = require("../utils/logger");

let s3Client = null;

const initS3 = () => {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region    = process.env.AWS_REGION || "ap-south-1";

  if (!accessKey || !secretKey) {
    logger.warn("⚠️  AWS credentials not set — audio files will not be stored in S3.");
    logger.warn("   In dev mode, audio responses are returned as base64 directly.");
    return;
  }

  try {
    const AWS = require("aws-sdk");
    AWS.config.update({ accessKeyId: accessKey, secretAccessKey: secretKey, region });
    s3Client = new AWS.S3();
    logger.info("✅ AWS S3 initialized");
  } catch (err) {
    logger.error(`❌ S3 init failed: ${err.message}`);
  }
};

/**
 * Upload a buffer to S3 and return the public URL.
 * If S3 is not configured, returns null (caller handles dev fallback).
 */
const uploadToS3 = async (buffer, key, contentType = "audio/mpeg") => {
  if (!s3Client) return null;

  const bucket = process.env.AWS_S3_BUCKET || "krishimitra-audio";

  try {
    const result = await s3Client.upload({
      Bucket:      bucket,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    }).promise();

    return result.Location;
  } catch (err) {
    logger.error(`S3 upload failed: ${err.message}`);
    return null;
  }
};

module.exports = { initS3, uploadToS3 };