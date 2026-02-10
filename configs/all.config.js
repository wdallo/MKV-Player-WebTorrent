// Performance configuration constants
export const PERF_CONFIG = {
  // Torrent management
  MAX_CONCURRENT_TORRENTS: 15, // Maximum number of active torrents simultaneously
  PIECE_SELECTION_BATCH_SIZE: 25, // Number of pieces to select per batch operation
  PIECE_SELECTION_INTERVAL: 3, // Interval for skipping pieces during selection

  // Download sizes
  INITIAL_DOWNLOAD_SIZE: 12582912, // Initial buffer size (12MB) for playback startup
  STREAMING_DOWNLOAD_SIZE: 8388608, // Ongoing streaming buffer size (8MB)

  // Monitoring intervals
  RESOURCE_LOG_INTERVAL: 180000, // Resource usage logging interval (3 minutes)
  CLEANUP_INTERVAL: 1200000, // Periodic cleanup interval (20 minutes)
  FILE_WATCH_DEBOUNCE: 500, // File system watch debounce delay (ms)

  // Security limits
  MAX_FILE_SIZE: 10737418240, // Maximum file size limit (10GB)
  MAX_MAGNET_LENGTH: 2048, // Maximum allowed magnet URL length (characters)
  CONNECTION_TIMEOUT: 30000, // Connection timeout duration (ms)
};

export const PLAYER_CONFIG = {
  // Retry configuration
  MAX_RETRIES: 20, // Maximum number of retry attempts for failed operations
  BASE_RETRY_DELAY: 1000, // Initial delay between retries (ms)
  MAX_RETRY_DELAY: 6000, // Maximum delay cap for exponential backoff (ms)
  CONTINUOUS_RETRY_INTERVAL: 20000, // Interval for continuous polling fallback (ms)

  // Status and readiness
  STATUS_POLL_INTERVAL: 600, // Poll interval for checking playback status (ms)
  READY_THRESHOLD: 524288, // Minimum buffered bytes (512KB) required to start playback

  // Timeout thresholds
  RESOURCE_TIMEOUT: 200, // Maximum wait time for resource to load (ms)
  STALL_TIMEOUT: 12000, // Time to detect and handle playback stalls (ms)

  // Visual settings
  WATERMARK: false, // Toggle watermark display
  WATERMARK_CONTENT: "Demo Watermark", // Text displayed in watermark

  // File management
  MANUAL_CLEANUP: true, // Immediately clean up files when player closes
  AUTO_DELETE_HOURS: 24, // Automatically delete cached files after N hours

  // Development
  DEBUG_MODE: true, // Enable detailed debug logging to console

  // Optimization
  DOM_CACHE_TIMEOUT: 30000, // Cache timeout for DOM element queries (ms)
  DEBOUNCE_DELAY: 100, // Debounce interval for UI event handlers (ms)

  // Safety
  ENABLE_CSP: true, // Enable Content Security Policy headers
  RATE_LIMIT: 100, // Maximum allowed requests per minute
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
