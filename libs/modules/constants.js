/**
 * Constants Module
 * All configuration constants used throughout the player
 */

export const CIRCUIT_BREAKER = {
  MAX_ERRORS_PER_MINUTE: 10,
  RESET_INTERVAL: 60000, // 1 minute
  RELOAD_DELAY: 1000, // 1 second
};

export const WATCHDOG = {
  FREEZE_THRESHOLD: 30000, // 30 seconds
  CHECK_INTERVAL: 5000, // 5 seconds
  HEARTBEAT_INTERVAL: 1000, // 1 second
};

export const MEMORY = {
  HIGH_USAGE_THRESHOLD: 0.8, // 80% of limit
  KB: 1024,
  MB: 1024 * 1024,
};

export const UI = {
  STATUS_UPDATE_DEBOUNCE: 50, // ms
  CONTEXT_MENU_DELAY: 50, // ms
  CONTEXT_MENU_UPDATE_INTERVAL: 1000, // 1 second
  CONTEXT_MENU_Z_INDEX: 10000,
  LOADING_OVERLAY_Z_INDEX: 9999,
};

export const HTTP_STATUS = {
  OK: 200,
  NOT_READY: "NOT_READY",
};

export const RETRY = {
  DELAY_INCREMENT: 500, // ms
  POLL_DELAY: 500, // ms
};
