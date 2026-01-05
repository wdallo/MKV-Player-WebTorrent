// Performance configuration constants
const MB = 1024 * 1024;
const MINUTE = 60 * 1000;

export const PERF_CONFIG = {
  // Torrent management
  MAX_CONCURRENT_TORRENTS: 15, // Maximum active torrents
  PIECE_SELECTION_BATCH_SIZE: 25, // Pieces to select per batch
  PIECE_SELECTION_INTERVAL: 3, // Skip interval for piece selection

  // Download sizes
  INITIAL_DOWNLOAD_SIZE: 12 * MB, // Initial buffer size for startup
  STREAMING_DOWNLOAD_SIZE: 8 * MB, // Ongoing streaming buffer

  // Monitoring intervals
  RESOURCE_LOG_INTERVAL: 3 * MINUTE, // Resource usage logging
  CLEANUP_INTERVAL: 20 * MINUTE, // Periodic cleanup interval
  FILE_WATCH_DEBOUNCE: 500, // File watch debounce delay (ms)

  // Security limits
  MAX_FILE_SIZE: 10 * 1024 * MB, // 10GB max file size
  MAX_MAGNET_LENGTH: 2048, // Maximum magnet URL length
  CONNECTION_TIMEOUT: 30000, // Connection timeout (ms)
};

export const PLAYER_CONFIG = {
  // Retry configuration
  MAX_RETRIES: 20, // Maximum retry attempts
  BASE_RETRY_DELAY: 1000, // Initial retry delay (ms)
  MAX_RETRY_DELAY: 6000, // Maximum retry delay (ms)
  CONTINUOUS_RETRY_INTERVAL: 20000, // Continuous polling interval (ms)

  // Status and polling
  STATUS_POLL_INTERVAL: 600, // Status update frequency (ms)
  READY_THRESHOLD: 512 * 1024, // 512KB minimum before playback

  // Timeouts
  RESOURCE_TIMEOUT: 200, // Resource load timeout (ms)
  STALL_TIMEOUT: 12000, // Playback stall detection (ms)

  // Display options
  WATERMARK: false, // Show/hide watermark
  WATERMARK_CONTENT: "Demo Watermark", // Watermark text

  // Cleanup behavior
  MANUAL_CLEANUP: true, // Immediate cleanup on close
  AUTO_DELETE_HOURS: 24, // Auto-delete after (hours)

  // Debug
  DEBUG_MODE: true, // Enable debug logging

  // Performance
  DOM_CACHE_TIMEOUT: 30000, // DOM cache timeout (ms)
  DEBOUNCE_DELAY: 100, // UI debounce delay (ms)

  // Security
  ENABLE_CSP: true, // Content Security Policy
  RATE_LIMIT: 100, // Requests per minute
};

// Plyr player configuration
export const PLYR_CONFIG = {
  controls: [
    "play-large",
    "play",
    "progress",
    "current-time",
    "duration",
    "mute",
    "volume",
    "fullscreen",
  ],

  // Behavior
  autopause: true,
  seekTime: 10,
  volume: 1,
  muted: false,
  clickToPlay: true,
  disableContextMenu: true,
  hideControls: true,
  resetOnEnd: false,
  autoplay: false,

  // Keyboard shortcuts
  keyboard: {
    focused: true,
    global: false,
  },

  // Tooltips
  tooltips: {
    controls: true,
    seek: true,
  },

  // Fullscreen
  fullscreen: {
    enabled: true,
    fallback: true,
    iosNative: true,
  },
};

// Plyr CSS color theme
export const PLYR_THEME = {
  // Primary color (progress bar, buttons, etc.)
  primaryColor: "#00b3ff",
  // Video background
  videoBackground: "#000000",
  // Control bar background
  controlBackground: "rgba(35, 40, 47, 0.85)",
  // Control bar background when hovering
  controlBackgroundHover: "rgba(35, 40, 47, 0.95)",
  // Text color
  textColor: "#ffffff",
  // Muted/inactive color
  mutedColor: "#b3b3b3",
  // Slider track color (progress bar background)
  sliderTrackColor: "rgba(255, 255, 255, 0.2)",
  // Buffered progress color
  bufferColor: "rgba(0, 179, 255, 0.3)",
  // Tooltip background
  tooltipBackground: "rgba(35, 40, 47, 0.95)",
  // Tooltip text color
  tooltipColor: "#ffffff",
  // Menu background
  menuBackground: "rgba(35, 40, 47, 0.98)",
  // Menu shadow
  menuShadow: "0 2px 8px rgba(0,0,0,0.15)",
  // Badge background (for quality/speed indicators)
  badgeBackground: "#00b3ff",
  badgeTextColor: "#ffffff",
  // Loading spinner color
  loadingColor: "#00b3ff",
  // Focus ring color
  focusColor: "#00b3ff",
  // Border radius for controls
  borderRadius: "3px",
  // Control size
  controlSize: "32px",
  // Icon size
  iconSize: "20px",
  // Large icon size for play button
  iconSizeLarge: "28px",
  // Control size for large elements
  controlSizeLarge: "64px",
  // Play button size
  playButtonSize: "64px",

  // Font family
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSizeSmall: "12px",
  fontSizeBase: "13px",
  fontSizeLarge: "54px",
};
