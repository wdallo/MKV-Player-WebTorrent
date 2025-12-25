// Enhanced magnet link validation utility with comprehensive security checks

// Constants
const MIN_MAGNET_LENGTH = 20;
const MAX_MAGNET_LENGTH = 2048;
const MIN_HASH_LENGTH = 32;
const MAX_HASH_LENGTH = 40;

export function isValidMagnet(url) {
  try {
    // Basic null/undefined/empty checks
    if (!url || typeof url !== "string") {
      return false;
    }

    // Trim whitespace and validate length
    url = url.trim();
    if (url.length < MIN_MAGNET_LENGTH || url.length > MAX_MAGNET_LENGTH) {
      return false;
    }

    // Check if it starts with magnet:
    if (!url.startsWith("magnet:?")) {
      return false;
    }

    // Must have xt parameter with btih hash
    if (!url.includes("xt=urn:btih:")) {
      return false;
    }

    // Extract and validate the info hash
    const xtMatch = url.match(/xt=urn:btih:([a-zA-Z0-9]{32,40})/);
    if (!xtMatch || !xtMatch[1]) {
      return false;
    }

    const hash = xtMatch[1];
    if (hash.length < MIN_HASH_LENGTH || hash.length > MAX_HASH_LENGTH) {
      return false;
    }

    // Additional security checks - only block truly dangerous characters
    // Allow single quotes (common in titles) but block script injection attempts
    if (/[<>"\\]/.test(url)) {
      console.warn(
        "[SECURITY] Magnet URI contains potentially unsafe characters"
      );
      return false;
    }

    // Check for common magnet URI structure - simplified but secure
    // Allow standard URI characters and percent-encoded values
    const validParams = /^magnet:\?[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/;
    if (!validParams.test(url)) {
      console.warn("[VALIDATION] Magnet URI contains invalid characters:", url);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[ERROR] Error validating magnet URI:", error);
    return false;
  }
}

// Additional utility for extracting hash from magnet
export function extractHashFromMagnet(url) {
  try {
    if (!isValidMagnet(url)) {
      return null;
    }

    const hashRegex = new RegExp(
      `[?&]xt=urn:(btih|sha1|md5):([a-zA-Z0-9]{${MIN_HASH_LENGTH},${MAX_HASH_LENGTH}})`,
      "i"
    );
    const xtMatch = url.match(hashRegex);
    return xtMatch ? xtMatch[2] : null;
  } catch (error) {
    console.error("[ERROR] Error extracting hash from magnet:", error);
    return null;
  }
}

// Utility for sanitizing magnet URLs
export function sanitizeMagnet(url) {
  try {
    if (!url || typeof url !== "string") {
      return null;
    }

    // Remove potentially dangerous characters
    const sanitized = url.trim().replace(/[<>"'\\]/g, "");

    return isValidMagnet(sanitized) ? sanitized : null;
  } catch (error) {
    console.error("[ERROR] Error sanitizing magnet URI:", error);
    return null;
  }
}
