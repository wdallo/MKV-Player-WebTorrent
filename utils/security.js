/**
 * Enhanced security middleware and utilities
 * Provides comprehensive security features for the application
 */

import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { SECURITY_CONFIG, ENV } from "../configs/environment.config.js";
import { createLogger } from "./logger.js";
import { sanitizeString, isValidMagnet } from "./validator.js";

const logger = createLogger("SECURITY");

/**
 * Smart rate limiting for streaming applications
 */
export const rateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW,
  max: (req) => {
    // Different limits based on endpoint type
    if (req.url.includes("/video") || req.url.includes("/audio")) {
      return SECURITY_CONFIG.RATE_LIMIT_STREAMING;
    }
    if (
      req.url.includes("/subtitles") ||
      req.url.includes("/status") ||
      req.url.includes("/health")
    ) {
      return SECURITY_CONFIG.RATE_LIMIT_POLLING;
    }
    if (req.url.includes("/player") || req.url.includes("/embed")) {
      return SECURITY_CONFIG.RATE_LIMIT_PAGES;
    }
    return SECURITY_CONFIG.RATE_LIMIT_DEFAULT;
  },
  message: {
    error: "Rate limit exceeded. Please wait before making more requests.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const isLocalhost =
      req.ip === "::1" ||
      req.ip === "127.0.0.1" ||
      req.ip === "::ffff:127.0.0.1" ||
      req.hostname === "localhost";

    return isLocalhost || ENV.IS_DEVELOPMENT || ENV.IS_ELECTRON;
  },
  skipFailedRequests: true,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    res.status(429).json({
      error: "Too many requests",
      message: "Please wait before making more requests",
      retryAfter: 60,
    });
  },
});

/**
 * Enhanced security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: SECURITY_CONFIG.CSP_DIRECTIVES,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

/**
 * Input sanitization middleware
 */
export function sanitizeInputs(req, res, next) {
  try {
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach((key) => {
        if (typeof req.query[key] === "string") {
          req.query[key] = sanitizeString(req.query[key]);
        }
      });
    }

    // Sanitize body parameters
    if (req.body && typeof req.body === "object") {
      Object.keys(req.body).forEach((key) => {
        if (typeof req.body[key] === "string") {
          req.body[key] = sanitizeString(req.body[key]);
        }
      });
    }

    next();
  } catch (error) {
    logger.error("Error sanitizing inputs", error);
    next(error);
  }
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeout = SECURITY_CONFIG.REQUEST_TIMEOUT) {
  return (req, res, next) => {
    // Skip timeout for streaming endpoints
    if (req.url.includes("/video") || req.url.includes("/audio")) {
      return next();
    }

    const timer = setTimeout(() => {
      logger.warn("Request timeout", {
        url: req.url,
        method: req.method,
        ip: req.ip,
      });

      if (!res.headersSent) {
        res.status(408).json({
          error: "Request timeout",
          message: "The request took too long to process",
        });
      }
    }, timeout);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}

/**
 * Enhanced security logger middleware
 */
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
    };

    // Log based on status and conditions
    const isHealthCheck = req.url === "/health" || req.url === "/status";
    const isLocalhost =
      req.ip === "::1" ||
      req.ip === "127.0.0.1" ||
      req.ip === "::ffff:127.0.0.1";

    // Log errors or slow requests
    if (res.statusCode >= 400) {
      logger.warn("Request failed", logData);
    } else if (duration > 10000 && !(isHealthCheck && isLocalhost)) {
      logger.warn("Slow request detected", logData);
    }
  });

  next();
}

/**
 * Enhanced error handler middleware
 */
export function errorHandler(err, req, res, next) {
  // Log error with context
  logger.error("Request error", {
    message: err.message,
    stack: ENV.IS_DEVELOPMENT ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send appropriate error response
  res.status(statusCode).json({
    error: ENV.IS_DEVELOPMENT ? err.message : "Internal Server Error",
    ...(ENV.IS_DEVELOPMENT && { stack: err.stack }),
    ...(err.details && { details: err.details }),
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req, res) {
  logger.warn("Route not found", {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: "Not Found",
    message: "The requested resource was not found",
    path: req.url,
  });
}

/**
 * Async error wrapper
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate magnet URL middleware
 */
export function validateMagnet(req, res, next) {
  const magnet = req.query.url || req.body.url;

  if (!magnet) {
    return res.status(400).json({
      error: "Missing magnet URL",
      message: "A magnet URL is required",
    });
  }

  if (!isValidMagnet(magnet)) {
    logger.warn("Invalid magnet URL attempt", {
      ip: req.ip,
      magnet: magnet.substring(0, 100),
    });

    return res.status(400).json({
      error: "Invalid magnet URL",
      message: "The provided magnet URL is not valid",
    });
  }

  next();
}

/**
 * CORS configuration
 */
export function configureCORS(app) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Allow localhost and Electron in development
    if (ENV.IS_DEVELOPMENT || ENV.IS_ELECTRON) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Content-Length, Accept-Ranges",
    );

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });
}
