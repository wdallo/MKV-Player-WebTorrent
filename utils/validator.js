/**
 * Input validation utilities for security and data integrity
 */

import { createLogger } from "./logger.js";

const logger = createLogger("VALIDATOR");

/**
 * Validate magnet URI format
 */
export function isValidMagnet(magnet) {
  if (!magnet || typeof magnet !== "string") {
    return false;
  }

  // Check length to prevent DoS
  if (magnet.length > 2048) {
    logger.warn("Magnet URI too long", { length: magnet.length });
    return false;
  }

  // Must start with magnet:
  if (!magnet.startsWith("magnet:")) {
    return false;
  }

  // Must contain xt parameter (exact topic - hash)
  if (!magnet.includes("xt=urn:btih:")) {
    return false;
  }

  // Extract info hash and validate
  const hashMatch = magnet.match(
    /xt=urn:btih:([a-fA-F0-9]{40}|[A-Za-z2-7]{32})/,
  );
  if (!hashMatch) {
    return false;
  }

  return true;
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizeFilePath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return "";
  }

  // Remove any path traversal attempts
  const sanitized = filePath
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  return sanitized;
}

/**
 * Validate numeric range for HTTP range requests
 */
export function validateRange(range, fileSize) {
  if (!range || typeof range !== "string") {
    return null;
  }

  const match = range.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return null;
  }

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Validate bounds
  if (
    isNaN(start) ||
    isNaN(end) ||
    start < 0 ||
    end >= fileSize ||
    start > end
  ) {
    return null;
  }

  return { start, end };
}

/**
 * Validate audio/video track number
 */
export function validateTrackNumber(track) {
  if (track === undefined || track === null) {
    return 0;
  }

  const trackNum = parseInt(track, 10);
  if (isNaN(trackNum) || trackNum < 0 || trackNum > 50) {
    return 0;
  }

  return trackNum;
}

/**
 * Validate seek time parameter
 */
export function validateSeekTime(time) {
  if (!time) {
    return 0;
  }

  const seekTime = parseFloat(time);
  if (isNaN(seekTime) || seekTime < 0 || seekTime > 86400) {
    // Max 24 hours
    return 0;
  }

  return seekTime;
}

/**
 * Sanitize and validate string input
 */
export function sanitizeString(input, maxLength = 1000) {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);

  // Remove control characters and non-printable characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  return sanitized;
}

/**
 * Validate MIME type for video/audio
 */
export function isValidMediaMime(mime) {
  if (!mime || typeof mime !== "string") {
    return false;
  }

  const validMimes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/x-matroska",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/webm",
    "audio/wav",
  ];

  return validMimes.includes(mime.toLowerCase());
}

/**
 * Validate file size
 */
export function isValidFileSize(size, maxSize = 10 * 1024 * 1024 * 1024) {
  // 10GB default
  if (typeof size !== "number" || isNaN(size)) {
    return false;
  }

  return size > 0 && size <= maxSize;
}

/**
 * Rate limiting key generator
 */
export function getRateLimitKey(req) {
  // Use IP address for rate limiting, handle proxies
  return req.ip || req.connection.remoteAddress || "unknown";
}
