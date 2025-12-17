// Enhanced magnet link validation utility with comprehensive security checks
export function isValidMagnet(url) {
  try {
    // Basic null/undefined/empty checks
    if (!url || typeof url !== "string") {
      return false;
    }

    // Trim whitespace and validate length
    url = url.trim();
    if (url.length < 20 || url.length > 2048) {
      return false;
    }

    // Enhanced regex for comprehensive magnet validation
    const magnetRegex =
      /^magnet:\?xt=urn:(btih|sha1|md5):[a-zA-Z0-9]{32,40}(&[a-zA-Z0-9%._~:/?#\[\]@!$&'()*+,;=-]*)?$/;

    if (!magnetRegex.test(url)) {
      return false;
    }

    // Additional security checks
    if (/[<>"'\\]/.test(url)) {
      console.warn("Magnet URI contains potentially unsafe characters");
      return false;
    }

    // Validate that xt parameter exists and has proper format
    const xtMatch = url.match(/[?&]xt=([^&]*)/i);
    if (!xtMatch || !xtMatch[1]) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating magnet URI:", error);
    return false;
  }
}

// Additional utility for extracting hash from magnet
export function extractHashFromMagnet(url) {
  try {
    if (!isValidMagnet(url)) {
      return null;
    }

    const xtMatch = url.match(
      /[?&]xt=urn:(btih|sha1|md5):([a-zA-Z0-9]{32,40})/i
    );
    return xtMatch ? xtMatch[2] : null;
  } catch (error) {
    console.error("Error extracting hash from magnet:", error);
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
    console.error("Error sanitizing magnet URI:", error);
    return null;
  }
}
