export const PERF_CONFIG = {
  MAX_CONCURRENT_TORRENTS: 10,
  PIECE_SELECTION_BATCH_SIZE: 20, // Reduced from 50 for better performance
  PIECE_SELECTION_INTERVAL: 5,
  INITIAL_DOWNLOAD_SIZE: 8 * 1024 * 1024, // 8MB for faster startup
  STREAMING_DOWNLOAD_SIZE: 5 * 1024 * 1024, // 5MB for streaming
  RESOURCE_LOG_INTERVAL: 5 * 60 * 1000, // 5 minutes
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes
  FILE_WATCH_DEBOUNCE: 1000, // 1 second debounce for file events
};

export const PLAYER_CONFIG = {
  MAX_RETRIES: 15, // Reduced for faster failure handling
  BASE_RETRY_DELAY: 1500, // Faster initial retry
  MAX_RETRY_DELAY: 8000, // Reduced max delay
  CONTINUOUS_RETRY_INTERVAL: 25000, // Slightly faster continuous polling
  STATUS_POLL_INTERVAL: 800, // Faster status updates for responsiveness
  READY_THRESHOLD: 256 * 1024, // Bytes downloaded before marking player as ready (256KB)
  RESOURCE_TIMEOUT: 250, // Reduced timeout for faster failure detection
  STALL_TIMEOUT: 15000, // Faster stall detection
  WATERMARK: false, // Show watermark on player if true
  WATERMARK_CONTENT: "Demo Watermark", // Text to display as watermark on video
  MANUAL_CLEANUP: false, // Enable immediate cleanup when player is closed/navigated away
  AUTO_DELETE_HOURS: 72, // Hours after which unused torrents are automatically deleted
  DEBUG_MODE: true, // Debug Mode on (true) / off (false)
};
