/**
 * Environment configuration with validation and defaults
 * Centralizes all configuration management
 */

import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Size constants
 */
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Application environment configuration
 */
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "production",
  PORT: parseInt(process.env.PORT || "3000", 10),
  LOG_LEVEL: process.env.LOG_LEVEL || "INFO",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
  IS_ELECTRON:
    typeof process !== "undefined" &&
    process.versions &&
    !!process.versions.electron,
};

/**
 * Server configuration
 */
export const SERVER_CONFIG = {
  PORT: ENV.PORT,
  HOST: process.env.HOST || "localhost",
  COMPRESSION_LEVEL: 6,
  COMPRESSION_THRESHOLD: KB,
  JSON_LIMIT: "10mb",
  URL_ENCODED_LIMIT: "10mb",
  TRUST_PROXY: process.env.TRUST_PROXY === "true",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

/**
 * Security configuration
 */
export const SECURITY_CONFIG = {
  // Rate limiting
  RATE_LIMIT_WINDOW: 15 * MINUTE,
  RATE_LIMIT_STREAMING: 10000,
  RATE_LIMIT_POLLING: 5000,
  RATE_LIMIT_PAGES: 100,
  RATE_LIMIT_DEFAULT: 500,

  // Input validation
  MAX_INPUT_LENGTH: 1000,
  MAX_MAGNET_LENGTH: 2048,
  MAX_FILE_SIZE: 10 * GB,

  // Timeouts
  CONNECTION_TIMEOUT: 30000,
  REQUEST_TIMEOUT: 120000,

  // Content Security Policy
  CSP_DIRECTIVES: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://cdn.jsdelivr.net",
      "https://cdn.plyr.io",
    ],
    imgSrc: ["'self'", "data:", "blob:"],
    mediaSrc: ["'self'", "blob:"],
    connectSrc: [
      "'self'",
      "ws:",
      "wss:",
      "https://cdn.jsdelivr.net",
      "https://cdn.plyr.io",
    ],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
};

/**
 * Torrent configuration
 */
export const TORRENT_CONFIG = {
  // WebTorrent client settings
  MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS || "50", 10),
  UPLOAD_LIMIT: 2 * MB, // 2 MB/s
  DOWNLOAD_LIMIT: -1, // Unlimited
  CHUNK_SIZE: 16 * KB,

  // Torrent management
  MAX_CONCURRENT_TORRENTS: 15,
  PIECE_SELECTION_BATCH_SIZE: 25,
  PIECE_SELECTION_INTERVAL: 3,

  // Download sizes
  INITIAL_DOWNLOAD_SIZE: 12 * MB,
  STREAMING_DOWNLOAD_SIZE: 8 * MB,
  MIN_READY_BYTES: 512 * KB,

  // Timeouts and intervals
  AUTO_DELETE_DELAY: 72 * HOUR,
  STATE_CLEANUP_DELAY: 5000,
  INACTIVE_THRESHOLD: HOUR,

  // Caching
  CACHE_TTL: 30000,
  CACHE_MAX_SIZE: 50,
  CACHE_CLEANUP_AGE: 5 * MINUTE,

  // File watching
  FILE_WATCH_DEBOUNCE: 500,

  // Tracker configuration
  DHT_ENABLED: true,
  LSD_ENABLED: true,
  WEB_SEEDS_ENABLED: true,
  UTP_ENABLED: true,
  BLOCKLIST_ENABLED: false,
};

/**
 * Streaming configuration
 */
export const STREAMING_CONFIG = {
  // Playback settings
  MIN_READY_BYTES: 256 * KB,
  PRIORITY_PIECES: 20,
  RANGE_ADJUSTMENT_THRESHOLD: 80,

  // Buffer sizes
  BUFFER_SIZE: 64 * KB,
  HIGH_WATER_MARK: 256 * KB,

  // Retry configuration
  MAX_RETRIES: 20,
  BASE_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 6000,
  CONTINUOUS_RETRY_INTERVAL: 20000,

  // Polling
  STATUS_POLL_INTERVAL: 600,

  // Timeouts
  STALL_TIMEOUT: 12000,
  RESOURCE_TIMEOUT: 200,
};

/**
 * File system configuration
 */
export const FS_CONFIG = {
  DOWNLOAD_DIR:
    process.env.DOWNLOADS_DIR ||
    global.DOWNLOADS_DIR ||
    path.join(__dirname, "../downloads"),
  TEMP_DIR: process.env.TEMP_DIR || path.join(__dirname, "../temp"),
  CLEANUP_INTERVAL: 20 * MINUTE,
  RESOURCE_LOG_INTERVAL: 3 * MINUTE,
  MAX_FILE_AGE: 24 * HOUR,
};

/**
 * Electron configuration
 */
export const ELECTRON_CONFIG = {
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WIDTH: 1000,
  MIN_HEIGHT: 700,
  SERVER_START_DELAY: 2000,
  BACKGROUND_COLOR: "#1a1a1a",
};

/**
 * Player configuration
 */
export const PLAYER_CONFIG = {
  WATERMARK: false,
  WATERMARK_CONTENT: "MKV Player",
  MANUAL_CLEANUP: true,
  AUTO_DELETE_HOURS: 24,
  DEBUG_MODE: ENV.IS_DEVELOPMENT,
};

/**
 * Validate configuration on load
 */
function validateConfig() {
  const errors = [];

  if (SERVER_CONFIG.PORT < 1 || SERVER_CONFIG.PORT > 65535) {
    errors.push("Invalid PORT: must be between 1 and 65535");
  }

  if (TORRENT_CONFIG.MAX_CONCURRENT_TORRENTS < 1) {
    errors.push("Invalid MAX_CONCURRENT_TORRENTS: must be at least 1");
  }

  if (SECURITY_CONFIG.MAX_FILE_SIZE < MB) {
    errors.push("Invalid MAX_FILE_SIZE: must be at least 1 MB");
  }

  if (errors.length > 0) {
    console.error("[CONFIG] Validation errors:");
    errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error("Configuration validation failed");
  }
}

// Validate configuration on module load
validateConfig();

/**
 * Export all configuration
 */
export default {
  ENV,
  SERVER_CONFIG,
  SECURITY_CONFIG,
  TORRENT_CONFIG,
  STREAMING_CONFIG,
  FS_CONFIG,
  ELECTRON_CONFIG,
  PLAYER_CONFIG,
};
