// Security middleware and utilities for the MKV Player WebTorrent application
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Smart rate limiting for streaming applications
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window (longer for streaming)
  max: async (req) => {
    // Different limits based on endpoint type
    if (req.url.includes("/video") || req.url.includes("/audio")) {
      return 10000; // Very high limit for media streaming
    }
    if (req.url.includes("/subtitles") || req.url.includes("/status")) {
      return 5000; // High limit for frequent polling endpoints
    }
    if (req.url.includes("/player") || req.url.includes("/embed")) {
      return 100; // Normal limit for page loads
    }
    return 500; // Default moderate limit
  },
  message: {
    error: "Rate limit exceeded. Please wait before making more requests.",
    retryAfter: 60,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for localhost and development
  skip: (req) => {
    const isLocalhost =
      req.ip === "::1" ||
      req.ip === "127.0.0.1" ||
      req.ip === "::ffff:127.0.0.1" ||
      req.hostname === "localhost";

    const isDevelopment = process.env.NODE_ENV === "development";

    return isLocalhost || isDevelopment;
  },
  // Don't count failed requests against limit
  skipFailedRequests: true,
});

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.jsdelivr.net",
        "https://cdn.plyr.io/",
      ],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: [
        "'self'",
        "ws:",
        "wss:",
        "https://cdn.jsdelivr.net",
        "https://cdn.plyr.io/",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for WebTorrent compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Input sanitization utilities
export function sanitizeInput(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .trim()
    .replace(/[<>\"'&]/g, "") // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

// Validate file paths to prevent directory traversal
export function isValidPath(filePath) {
  if (typeof filePath !== "string") {
    return false;
  }

  // Check for directory traversal attempts
  if (filePath.includes("..") || filePath.includes("~")) {
    return false;
  }

  // Check for absolute paths
  if (filePath.startsWith("/") || /^[A-Za-z]:/.test(filePath)) {
    return false;
  }

  return true;
}

// Validate magnet URLs with enhanced security
export function validateMagnetURL(url) {
  try {
    if (!url || typeof url !== "string") {
      return { valid: false, error: "Invalid URL type" };
    }

    // Length validation
    if (url.length > 2048) {
      return { valid: false, error: "URL too long" };
    }

    // Basic magnet format validation
    if (!url.startsWith("magnet:?xt=urn:btih:")) {
      return { valid: false, error: "Invalid magnet format" };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /<script/i,
      /on\w+=/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        return { valid: false, error: "Suspicious content detected" };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Validation error" };
  }
}

// Error handling middleware
export function errorHandler(err, req, res, next) {
  // Log error for monitoring
  console.error("Security Error:", {
    message: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : "Internal Server Error",
    ...(isDevelopment && { stack: err.stack }),
  });
}

// Request logging middleware for security monitoring
export function securityLogger(req, res, next) {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logData = {
      ip: req.ip,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    };

    // Log suspicious activity
    if (res.statusCode >= 400 || duration > 10000) {
      console.warn("Suspicious Activity:", logData);
    }
  });

  next();
}
