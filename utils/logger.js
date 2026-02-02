/**
 * Centralized logging utility with levels and formatting
 * Provides consistent logging across the application
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor(context = "APP") {
    this.context = context;
    this.level = process.env.LOG_LEVEL || "INFO";
    this.currentLevel = LOG_LEVELS[this.level] || LOG_LEVELS.INFO;
  }

  /**
   * Format log message with timestamp and context
   */
  _format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [${this.context}] ${message}`;

    if (data !== null && data !== undefined) {
      return `${formatted} ${JSON.stringify(data)}`;
    }
    return formatted;
  }

  /**
   * Log error messages
   */
  error(message, error = null) {
    if (this.currentLevel >= LOG_LEVELS.ERROR) {
      console.error(this._format("ERROR", message));
      if (error) {
        console.error(error.stack || error);
      }
    }
  }

  /**
   * Log warning messages
   */
  warn(message, data = null) {
    if (this.currentLevel >= LOG_LEVELS.WARN) {
      console.warn(this._format("WARN", message, data));
    }
  }

  /**
   * Log info messages
   */
  info(message, data = null) {
    if (this.currentLevel >= LOG_LEVELS.INFO) {
      console.log(this._format("INFO", message, data));
    }
  }

  /**
   * Log debug messages
   */
  debug(message, data = null) {
    if (this.currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(this._format("DEBUG", message, data));
    }
  }

  /**
   * Create a child logger with a different context
   */
  child(context) {
    return new Logger(`${this.context}:${context}`);
  }
}

/**
 * Create logger instance
 */
export function createLogger(context) {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = new Logger("APP");
