/**
 * Refactored Express Application with best practices
 * Main application entry point with enhanced security and performance
 */

import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { SERVER_CONFIG, ENV } from "./configs/environment.config.js";
import { createLogger } from "./utils/logger.js";

// Import security middleware
import {
  rateLimiter,
  securityHeaders,
  securityLogger,
  errorHandler,
  notFoundHandler,
  sanitizeInputs,
  requestTimeout,
} from "./utils/security.js";

// Import routes
import videoRoutes from "./routes/videoRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import statusRoutes from "./routes/statusRoutes.js";
import subtitleRoutes from "./routes/subtitleRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import embedRoutes from "./routes/embedRoutes.js";

const logger = createLogger("APP");

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure Express app
 */
function createApp() {
  const app = express();

  // Trust proxy if configured
  if (SERVER_CONFIG.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  // Disable x-powered-by header
  app.disable("x-powered-by");

  // Apply security middleware first
  app.use(securityHeaders);
  app.use(rateLimiter);
  app.use(securityLogger);

  // CORS configuration
  app.use(
    cors({
      origin: SERVER_CONFIG.CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Range", "Authorization"],
      exposedHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"],
    }),
  );

  // Compression middleware with smart filtering
  app.use(
    compression({
      level: SERVER_CONFIG.COMPRESSION_LEVEL,
      threshold: SERVER_CONFIG.COMPRESSION_THRESHOLD,
      filter: (req, res) => {
        // Don't compress media streams
        if (req.url.includes("/video") || req.url.includes("/audio")) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // Body parsing middleware
  app.use(
    express.json({
      limit: SERVER_CONFIG.JSON_LIMIT,
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: SERVER_CONFIG.URL_ENCODED_LIMIT,
    }),
  );

  // Input sanitization
  app.use(sanitizeInputs);

  // Request timeout (except for streaming)
  app.use(requestTimeout());

  // Static files
  app.use(
    express.static(__dirname, {
      maxAge: ENV.IS_DEVELOPMENT ? 0 : "1d",
      etag: true,
    }),
  );

  // View engine setup
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      environment: ENV.NODE_ENV,
    });
  });

  // Mount routes
  app.use(playerRoutes);
  app.use(videoRoutes);
  app.use(audioRoutes);
  app.use(statusRoutes);
  app.use(subtitleRoutes);
  app.use(embedRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize torrent service
    logger.info("Initializing torrent service...");
    const { torrentService } = await import("./services/torrentService.js");
    await torrentService.initialize();
    logger.info("Torrent service initialized");

    // Create Express app
    const app = createApp();

    // Start listening
    const server = app.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOST, () => {
      logger.info("Server started", {
        port: SERVER_CONFIG.PORT,
        host: SERVER_CONFIG.HOST,
        environment: ENV.NODE_ENV,
        nodeVersion: process.version,
      });
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    return server;
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server) {
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info("Server closed, no longer accepting connections");
    });

    try {
      // Shutdown torrent service
      const { torrentService } = await import("./services/torrentService.js");
      await torrentService.shutdown();
      logger.info("Torrent service shut down");

      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Promise Rejection", {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", {
      message: error.message,
      stack: error.stack,
    });

    // Exit process after logging
    process.exit(1);
  });

  // Handle warnings
  process.on("warning", (warning) => {
    logger.warn("Process warning", {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });
}

// Start server if this is the main module
const modulePath = fileURLToPath(import.meta.url);
const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === modulePath;

if (isMainModule) {
  startServer();
}

// Export for testing
export { createApp, startServer };
export default createApp;
