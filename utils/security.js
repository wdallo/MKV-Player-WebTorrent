// Security middleware and utilities for the MKV Player WebTorrent application
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Constants
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_STREAMING = 10000;
const RATE_LIMIT_POLLING = 5000;
const RATE_LIMIT_PAGES = 100;
const RATE_LIMIT_DEFAULT = 500;
const MAX_INPUT_LENGTH = 1000;

// Smart rate limiting for streaming applications
export const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: async (req) => {
    // Different limits based on endpoint type
    if (req.url.includes("/video") || req.url.includes("/audio")) {
      return RATE_LIMIT_STREAMING; // Very high limit for media streaming
    }
    if (
      req.url.includes("/subtitles") ||
      req.url.includes("/status") ||
      req.url.includes("/health")
    ) {
      return RATE_LIMIT_POLLING; // High limit for frequent polling endpoints
    }
    if (req.url.includes("/player") || req.url.includes("/embed")) {
      return RATE_LIMIT_PAGES; // Normal limit for page loads
    }
    return RATE_LIMIT_DEFAULT; // Default moderate limit
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

    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "electron";
    const isElectron =
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.electron;

    // Skip for localhost, development, or Electron environment
    return isLocalhost || isDevelopment || isElectron;
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
        "'unsafe-hashes'",
        "https://cdn.jsdelivr.net",
        "https://cdn.plyr.io/",
      ],
      scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
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
    .substring(0, MAX_INPUT_LENGTH);
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
  const isDevelopment =
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "electron";

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

    // Log suspicious activity, but exclude legitimate requests
    const isHealthCheck = req.url === "/health" || req.url === "/";
    const isLocalhost =
      req.ip === "::1" ||
      req.ip === "127.0.0.1" ||
      req.ip === "::ffff:127.0.0.1";
    const isElectronAgent =
      req.get("User-Agent")?.includes("electron") ||
      req.get("User-Agent") === "node";

    // Don't flag health checks from localhost/Electron as suspicious
    const shouldLog =
      (res.statusCode >= 400 || duration > 10000) &&
      !(isHealthCheck && isLocalhost) &&
      !(isElectronAgent && isLocalhost);

    if (shouldLog) {
      console.warn("Suspicious Activity:", logData);
    }
  });

  next();
}
