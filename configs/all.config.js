export const PERF_CONFIG = {
  MAX_CONCURRENT_TORRENTS: 15, // Increased for better performance
  PIECE_SELECTION_BATCH_SIZE: 25, // Optimized batch size
  PIECE_SELECTION_INTERVAL: 3, // Reduced interval for faster piece selection
  INITIAL_DOWNLOAD_SIZE: 12 * 1024 * 1024, // 12MB for faster startup
  STREAMING_DOWNLOAD_SIZE: 8 * 1024 * 1024, // 8MB for better streaming
  RESOURCE_LOG_INTERVAL: 3 * 60 * 1000, // 3 minutes for better monitoring
  CLEANUP_INTERVAL: 20 * 60 * 1000, // 20 minutes for more frequent cleanup
  FILE_WATCH_DEBOUNCE: 500, // 0.5 second debounce for faster file events
  // Security settings
  MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB max file size
  MAX_MAGNET_LENGTH: 2048, // Maximum magnet URL length
  CONNECTION_TIMEOUT: 30000, // 30 seconds connection timeout
};

export const PLAYER_CONFIG = {
  MAX_RETRIES: 20, // Increased for better reliability
  BASE_RETRY_DELAY: 1000, // Faster initial retry
  MAX_RETRY_DELAY: 6000, // Reduced max delay for faster recovery
  CONTINUOUS_RETRY_INTERVAL: 20000, // Faster continuous polling
  STATUS_POLL_INTERVAL: 600, // Even faster status updates
  READY_THRESHOLD: 512 * 1024, // Increased to 512KB for more stable playback
  RESOURCE_TIMEOUT: 200, // Faster timeout for quicker failure detection
  STALL_TIMEOUT: 12000, // Faster stall detection
  WATERMARK: false, // Show watermark on player if true
  WATERMARK_CONTENT: "Demo Watermark", // Text to display as watermark on video
  MANUAL_CLEANUP: false, // Enable immediate cleanup when player is closed/navigated away
  AUTO_DELETE_HOURS: 48, // Reduced to 48 hours for better resource management
  DEBUG_MODE: true, // Debug Mode on (true) / off (false)
  // Performance optimizations
  DOM_CACHE_TIMEOUT: 30000, // 30 seconds DOM cache timeout
  DEBOUNCE_DELAY: 100, // Faster debounce for better UI responsiveness
  // Security settings
  ENABLE_CSP: true, // Enable Content Security Policy
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
