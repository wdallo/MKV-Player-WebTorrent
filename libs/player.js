/**
 * MKV Video Player Implementation
 * Class-based architecture
 */

// Magnet URL validation utility
import { isValidMagnet } from "../utils/magnetValidator.js";

// Configuration constants for player behavior and timeouts
// Player configuration constants
import {
  PLAYER_CONFIG,
  PLYR_CONFIG,
  PLYR_THEME,
} from "../configs/all.config.js";

// Make PLAYER_CONFIG available globally for UI access
const CONFIG = PLAYER_CONFIG;
window.CONFIG = PLAYER_CONFIG;

// Constants
const CIRCUIT_BREAKER = {
  MAX_ERRORS_PER_MINUTE: 10,
  RESET_INTERVAL: 60000, // 1 minute
  RELOAD_DELAY: 1000, // 1 second
};

const WATCHDOG = {
  FREEZE_THRESHOLD: 30000, // 30 seconds
  CHECK_INTERVAL: 5000, // 5 seconds
  HEARTBEAT_INTERVAL: 1000, // 1 second
};

const MEMORY = {
  HIGH_USAGE_THRESHOLD: 0.8, // 80% of limit
  KB: 1024,
  MB: 1024 * 1024,
};

const UI = {
  STATUS_UPDATE_DEBOUNCE: 50, // ms
  CONTEXT_MENU_DELAY: 50, // ms
  CONTEXT_MENU_UPDATE_INTERVAL: 1000, // 1 second
  CONTEXT_MENU_Z_INDEX: 10000,
  LOADING_OVERLAY_Z_INDEX: 9999,
};

const HTTP_STATUS = {
  OK: 200,
  NOT_READY: "NOT_READY",
};

const RETRY = {
  DELAY_INCREMENT: 500, // ms
  POLL_DELAY: 500, // ms
};

// Emergency crash prevention - catch everything
window.addEventListener("error", (e) => {
  console.error("EMERGENCY: Critical error caught:", e.error);
  if (checkCircuitBreaker()) return false;
  e.preventDefault();
  return false;
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("EMERGENCY: Critical promise rejection:", e.reason);
  if (checkCircuitBreaker()) return false;
  e.preventDefault();
  return false;
});

// Prevent STATUS_BREAKPOINT by catching all possible crashes
// Circuit breaker to prevent infinite loops
let globalErrorCount = 0;
let lastErrorTime = 0;

function checkCircuitBreaker() {
  const now = Date.now();
  if (now - lastErrorTime > CIRCUIT_BREAKER.RESET_INTERVAL) {
    globalErrorCount = 0; // Reset counter every minute
  }
  lastErrorTime = now;

  if (++globalErrorCount > CIRCUIT_BREAKER.MAX_ERRORS_PER_MINUTE) {
    console.error("[CIRCUIT BREAKER] Too many errors, forcing page reload");
    setTimeout(() => window.location.reload(), CIRCUIT_BREAKER.RELOAD_DELAY);
    return true;
  }
  return false;
}

// Watchdog timer to detect page freeze
let watchdogTimer;
let lastHeartbeat = Date.now();

function startWatchdog() {
  watchdogTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastHeartbeat > WATCHDOG.FREEZE_THRESHOLD) {
      console.error("[WATCHDOG] Page appears frozen, reloading...");
      window.location.reload();
    }
  }, WATCHDOG.CHECK_INTERVAL);
}

function heartbeat() {
  lastHeartbeat = Date.now();
}

// Start watchdog
startWatchdog();
setInterval(heartbeat, WATCHDOG.HEARTBEAT_INTERVAL);

// Chrome Resource Management
class ChromeResourceManager {
  static monitorMemory() {
    try {
      if (performance && performance.memory) {
        const memInfo = {
          used: Math.round(performance.memory.usedJSHeapSize / MEMORY.MB),
          total: Math.round(performance.memory.totalJSHeapSize / MEMORY.MB),
          limit: Math.round(performance.memory.jsHeapSizeLimit / MEMORY.MB),
        };

        if (CONFIG.DEBUG_MODE) {
          console.log(
            `[MEMORY] ${memInfo.used}MB / ${memInfo.total}MB (Limit: ${memInfo.limit}MB)`
          );
        }

        // Trigger cleanup if memory usage is high
        if (memInfo.used > memInfo.limit * MEMORY.HIGH_USAGE_THRESHOLD) {
          console.warn("[MEMORY] High usage detected, triggering cleanup");
          this.forceGarbageCollection();
          return true; // High memory usage
        }
      }
    } catch (error) {
      console.warn("[MEMORY] Error monitoring:", error);
    }
    return false;
  }

  static forceGarbageCollection() {
    try {
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }

      // Clear DOM caches safely
      try {
        document.querySelectorAll("*").forEach((el) => {
          if (el._cached) delete el._cached;
        });
      } catch (domError) {
        console.warn("[MEMORY] Error clearing DOM cache:", domError);
      }
    } catch (error) {
      console.warn("[MEMORY] Error forcing garbage collection:", error);
    }
  }

  static optimizeVideo(videoElement) {
    try {
      if (!videoElement) return;

      // Reduce video quality if high memory usage
      if (this.monitorMemory()) {
        videoElement.style.filter = "contrast(1.1)";
        if (CONFIG.DEBUG_MODE) {
          console.log("[MEMORY] Applied optimization to video element");
        }
      }

      // Preload optimization
      videoElement.preload = "metadata";

      // Disable picture-in-picture to save memory
      if (videoElement.disablePictureInPicture !== undefined) {
        videoElement.disablePictureInPicture = true;
      }
    } catch (error) {
      console.warn("Error optimizing video:", error);
    }
  }
}

// Type definitions (for better code documentation)
/**
 * @typedef {Object} TorrentStatus
 * @property {string} status - Current torrent status
 * @property {number} progress - Download progress (0-1)
 * @property {number} downloadSpeed - Speed in bytes/second
 * @property {number} downloaded - Bytes downloaded
 * @property {number} length - Total file size
 * @property {number} numPeers - Number of connected peers
 * @property {number} [noPeersSince] - Timestamp when no peers state started
 */

/**
 * UI Controller - Handles all DOM manipulations and user interface
 */
class UIController {
  constructor() {
    try {
      // Chrome resource optimization
      const playerElement = document.getElementById("player");
      if (playerElement) {
        ChromeResourceManager.optimizeVideo(playerElement);
      }

      // Cache references to important DOM elements with safe access
      this.elements = {
        progressBar: this.safeGetElement("progress-bar"),
        statusDetails: this.safeGetElement("status-details"),
        loading: this.safeGetElement("loading"),
        error: this.safeGetElement("error"),
        statusMsg: this.safeGetElement("status-msg"),
        retryBtn: this.safeGetElement("retry-btn"),
        videoContainer: this.safeGetElement("video-container"),
        plyrLoadingOverlay: this.safeGetElement("plyr-loading-overlay"),
        video: this.safeGetElement("player"),
        resumeBtn: this.safeGetElement("resume-btn"),
        restartBtn: this.safeGetElement("restart-btn"),
        resumeModule: this.safeGetElement("resume-module-inner"),
      };

      // Performance optimizations
      this._domCache = new Map();
      this._lastCacheTime = 0;
      this._debounceTimers = new Map();

      this.bindEvents();
    } catch (error) {
      console.error("[UI] Error initializing UIController:", error);
      this.elements = {};
    }
  }

  // Safe DOM element access to prevent crashes
  safeGetElement(id) {
    try {
      return document.getElementById(id);
    } catch (error) {
      console.warn(`[UI] Failed to get element with id: ${id}`, error);
      return null;
    }
  }

  // Bind UI events, such as retry button click
  bindEvents() {
    this.elements.retryBtn?.addEventListener("click", () => {
      this.onRetryClick?.();
    });
    this.elements.resumeBtn?.addEventListener("click", () => {
      this.onResumeClick?.();
    });
    this.elements.restartBtn?.addEventListener("click", () => {
      this.onRestartClick?.();
    });
  }

  // Performance helper: cached DOM query
  _getCachedElement(selector) {
    const now = Date.now();
    const cacheKey = selector;
    const cached = this._domCache.get(cacheKey);

    if (cached && now - this._lastCacheTime < CONFIG.DOM_CACHE_TIMEOUT) {
      return cached;
    }

    const element = document.querySelector(selector);
    this._domCache.set(cacheKey, element);
    this._lastCacheTime = now;
    return element;
  }

  // Performance helper: debounced execution
  _debounce(key, fn, delay = CONFIG.DEBOUNCE_DELAY) {
    const existing = this._debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      fn();
      this._debounceTimers.delete(key);
    }, delay);

    this._debounceTimers.set(key, timer);
  }

  /**
   * Updates the download progress bar and status (debounced for performance)
   * @param {TorrentStatus} data - Torrent status data
   */
  updateStatusBar(data) {
    // Check memory usage before heavy DOM updates
    ChromeResourceManager.monitorMemory();

    this._debounce(
      "statusUpdate",
      () => {
        if (!data) {
          if (this.elements.progressBar)
            this.elements.progressBar.style.width = "0%";
          if (this.elements.statusDetails)
            this.elements.statusDetails.textContent = "\u00A0"; // Unicode non-breaking space
          // Show progress bar container if hidden
          if (this.elements.progressBar?.parentElement)
            this.elements.progressBar.parentElement.style.display = "";
          return;
        }

        const percentage = (data.progress * 100).toFixed(1);
        const speedKB = (data.downloadSpeed / MEMORY.KB).toFixed(1);
        const downloadedMB = (data.downloaded / MEMORY.MB).toFixed(2);
        const totalMB = (data.length / MEMORY.MB).toFixed(2);

        const message = this.formatStatusMessage(data, {
          percentage,
          speedKB,
          downloadedMB,
          totalMB,
        });

        this.elements.progressBar.style.width = `${percentage}%`;
        this.elements.statusDetails.textContent = message;

        // Hide progress bar and status when download is complete
        if (data.status === "done") {
          if (this.elements.progressBar.parentElement)
            this.elements.progressBar.parentElement.style.display = "none";
          this.elements.statusDetails.style.display = "none";
        } else {
          // Show them if not done
          if (this.elements.progressBar.parentElement)
            this.elements.progressBar.parentElement.style.display = "";
          this.elements.statusDetails.style.display = "";
        }
      },
      UI.STATUS_UPDATE_DEBOUNCE
    );
  }

  // Formats the status message for the user
  formatStatusMessage(data, metrics) {
    const { percentage, speedKB, downloadedMB, totalMB } = metrics;

    const statusMessages = {
      "fetching metadata": "Fetching torrent metadata...",
      "no peers": "No seeds/peers found. Waiting...",
      connecting: "Connecting to peers...",
      downloading: `Downloading: ${percentage}% | ${downloadedMB} MB / ${totalMB} MB | ${speedKB} KB/s | ${data.numPeers} peers`,
      done: `Download complete! (${totalMB} MB)`,
    };

    let message = statusMessages[data.status] || `Status: ${data.status}`;

    // Add stall warning if no peers for a while
    if (
      data.status === "no peers" &&
      data.noPeersSince &&
      Date.now() - data.noPeersSince > CONFIG.STALL_TIMEOUT
    ) {
      message += " No seeds found or torrent stalled. Try another torrent.";
    }

    return message;
  }

  // Show debug step message
  showStep(message) {
    if (this.elements.stepDebug) {
      this.elements.stepDebug.textContent = message;
      this.elements.stepDebug.style.display = "";
    }
  }

  // Hide debug step message
  hideStep() {
    if (this.elements.stepDebug) {
      this.elements.stepDebug.style.display = "none";
    }
  }

  // Show error message
  showError(message) {
    this.elements.error.textContent = message;
    this.elements.error.style.display = "";
  }

  // Hide error message
  hideError() {
    this.elements.error.style.display = "none";
  }

  // Show retry button
  showRetryButton() {
    this.elements.retryBtn.style.display = "";
  }

  // Hide retry button
  hideRetryButton() {
    this.elements.retryBtn.style.display = "none";
  }

  // Show video container
  showVideoContainer() {
    this.elements.videoContainer.style.display = "";
  }

  // Hide video container
  hideVideoContainer() {
    this.elements.videoContainer.style.display = "none";
  }

  // Show Plyr loading overlay
  showPlyrLoadingOverlay() {
    if (this.elements.plyrLoadingOverlay) {
      this.elements.plyrLoadingOverlay.style.display = "";
    }
  }

  // Hide Plyr loading overlay
  hidePlyrLoadingOverlay() {
    if (this.elements.plyrLoadingOverlay) {
      this.elements.plyrLoadingOverlay.style.display = "none";
    }
  }

  // Update loading overlay text
  updatePlyrLoadingText(text) {
    const textElement =
      this.elements.plyrLoadingOverlay?.querySelector(".plyr-loading-text");
    if (textElement) {
      textElement.textContent = text;
    }
  }

  // Hide loading spinner
  hideLoading() {
    this.elements.loading.style.display = "none";
  }

  // Performance helper: cached DOM query
  _getCachedElement(selector) {
    const now = Date.now();
    const cacheKey = selector;
    const cached = this._domCache.get(cacheKey);

    if (cached && now - this._lastCacheTime < CONFIG.DOM_CACHE_TIMEOUT) {
      return cached;
    }

    const element = document.querySelector(selector);
    this._domCache.set(cacheKey, element);
    this._lastCacheTime = now;
    return element;
  }

  // Performance helper: debounced execution
  _debounce(key, fn, delay = CONFIG.DEBOUNCE_DELAY) {
    const existing = this._debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      fn();
      this._debounceTimers.delete(key);
    }, delay);

    this._debounceTimers.set(key, timer);
  }

  // Set main status message
  setStatusMessage(message) {
    this.elements.statusMsg.textContent = message;
  }

  // Show resume button
  showResumeButton() {
    if (this.elements.resumeBtn) this.elements.resumeBtn.style.display = "";
    if (this.elements.restartBtn) this.elements.restartBtn.style.display = "";
    if (this.elements.resumeModule)
      this.elements.resumeModule.style.display = "flex";
  }
  hideResumeButton() {
    if (this.elements.resumeBtn) this.elements.resumeBtn.style.display = "none";
    if (this.elements.restartBtn)
      this.elements.restartBtn.style.display = "none";
    if (this.elements.resumeModule)
      this.elements.resumeModule.style.display = "none";
  }

  // Context menu methods
  createContextMenu() {
    // Remove existing context menu
    this.removeContextMenu();

    const contextMenu = document.createElement("div");
    contextMenu.id = "video-context-menu";
    contextMenu.className = "video-context-menu";

    // Create header
    const header = document.createElement("div");
    header.className = "context-menu-header";
    const title = document.createElement("span");
    title.className = "context-menu-title";
    title.textContent = "Video Status";
    header.appendChild(title);

    // Create close button
    const closeButton = document.createElement("span");
    closeButton.className = "context-menu-close";
    closeButton.textContent = "×";
    closeButton.style.cursor = "pointer";
    closeButton.style.float = "right";
    closeButton.style.fontSize = "18px";
    closeButton.style.fontWeight = "bold";
    closeButton.style.color = "#999";
    closeButton.addEventListener("click", () => {
      this.removeContextMenu();
    });
    closeButton.addEventListener("mouseover", () => {
      closeButton.style.color = "#fff";
    });
    closeButton.addEventListener("mouseout", () => {
      closeButton.style.color = "#999";
    });
    header.appendChild(closeButton);

    // Create content container
    const content = document.createElement("div");
    content.className = "context-menu-content";

    // Create menu items
    const items = [
      {
        label: "Video Buffer:",
        id: "context-video-buffer",
        defaultText: "Loading...",
      },
      {
        label: "Subtitle Status:",
        id: "context-subtitle-status",
        defaultText: "Loading...",
      },
      {
        label: "Subtitle Progress:",
        id: "context-subtitle-progress",
        defaultText: "Loading...",
      },
      {
        label: "Download Progress:",
        id: "context-download-progress",
        defaultText: "Loading...",
      },
    ];

    items.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className = "context-menu-item";

      const label = document.createElement("span");
      label.className = "context-menu-label";
      label.textContent = item.label;

      const value = document.createElement("span");
      value.className = "context-menu-value";
      value.id = item.id;
      value.textContent = item.defaultText;

      menuItem.appendChild(label);
      menuItem.appendChild(value);
      content.appendChild(menuItem);
    });

    contextMenu.appendChild(header);
    contextMenu.appendChild(content);

    // Append to the correct container based on fullscreen state
    const isFullscreen = !!document.fullscreenElement;
    if (isFullscreen) {
      document.fullscreenElement.appendChild(contextMenu);
      contextMenu.style.position = "absolute";
      contextMenu.style.zIndex = "999999999";
    } else {
      document.body.appendChild(contextMenu);
      contextMenu.style.position = "fixed";
      contextMenu.style.zIndex = "10000";
    }

    return contextMenu;
  }

  showContextMenu(x, y) {
    const contextMenu = this.createContextMenu();
    const isFullscreen = !!document.fullscreenElement;

    // Update context menu with current status
    this.updateContextMenuStatus();

    // Position the menu, ensuring it stays within viewport
    const rect = contextMenu.getBoundingClientRect();

    let maxX, maxY, containerWidth, containerHeight;

    if (isFullscreen) {
      // In fullscreen, use the fullscreen element's dimensions
      const fsElement = document.fullscreenElement;
      containerWidth = fsElement.clientWidth;
      containerHeight = fsElement.clientHeight;

      // Convert viewport coordinates to fullscreen element coordinates
      const fsRect = fsElement.getBoundingClientRect();
      x = x - fsRect.left;
      y = y - fsRect.top;
    } else {
      // In windowed mode, use window dimensions
      containerWidth = window.innerWidth;
      containerHeight = window.innerHeight;
    }

    maxX = containerWidth - rect.width - 10;
    maxY = containerHeight - rect.height - 10;

    const finalX = Math.max(10, Math.min(x, maxX));
    const finalY = Math.max(10, Math.min(y, maxY));

    contextMenu.style.left = finalX + "px";
    contextMenu.style.top = finalY + "px";
    contextMenu.style.display = "block";

    // Hide context menu when clicking elsewhere
    const hideMenu = (e) => {
      if (!contextMenu.contains(e.target)) {
        this.removeContextMenu();
        // Remove both possible event listeners
        document.removeEventListener("click", hideMenu);
        document.removeEventListener("mousedown", hideMenu);
      }
    };

    // Use mousedown instead of click for better responsiveness
    setTimeout(() => {
      document.addEventListener("mousedown", hideMenu);
    }, UI.CONTEXT_MENU_DELAY);

    return contextMenu;
  }
  removeContextMenu() {
    const existingMenu = document.getElementById("video-context-menu");
    if (existingMenu) {
      existingMenu.remove();
    }
  }

  updateContextMenuStatus() {
    const videoBufferEl = document.getElementById("context-video-buffer");
    const subtitleStatusEl = document.getElementById("context-subtitle-status");
    const subtitleProgressEl = document.getElementById(
      "context-subtitle-progress"
    );
    const downloadProgressEl = document.getElementById(
      "context-download-progress"
    );

    if (
      !videoBufferEl ||
      !subtitleStatusEl ||
      !subtitleProgressEl ||
      !downloadProgressEl
    )
      return;

    // Update video buffer status
    if (this.elements.video) {
      const buffered = this.elements.video.buffered;
      const currentTime = this.elements.video.currentTime;
      const duration = this.elements.video.duration;

      if (buffered.length > 0 && duration > 0) {
        let bufferedAhead = 0;
        for (let i = 0; i < buffered.length; i++) {
          if (
            buffered.start(i) <= currentTime &&
            buffered.end(i) > currentTime
          ) {
            bufferedAhead = buffered.end(i) - currentTime;
            break;
          }
        }

        const bufferPercent = (
          (buffered.end(buffered.length - 1) / duration) *
          100
        ).toFixed(1);
        const bufferSeconds = bufferedAhead.toFixed(1);

        // Clear and rebuild content safely
        videoBufferEl.textContent = "";

        const percentSpan = document.createElement("span");
        percentSpan.style.color = "#4caf50";
        percentSpan.textContent = `${bufferPercent}%`;

        const aheadSpan = document.createElement("span");
        aheadSpan.style.color = "#81c784";
        aheadSpan.textContent = ` (+${bufferSeconds}s ahead)`;

        videoBufferEl.appendChild(percentSpan);
        videoBufferEl.appendChild(aheadSpan);
      } else {
        videoBufferEl.textContent = "No buffer data";
        videoBufferEl.style.color = "#ff9800";
      }
    } else {
      videoBufferEl.textContent = "Video not loaded";
      videoBufferEl.style.color = "#f44336";
    }

    // Update subtitle status (if subtitles manager exists)
    if (window.player && window.player.subtitlesManager) {
      const subtitles = window.player.subtitlesManager;

      // Check multiple indicators for subtitle status
      const hasInitializedSubtitles = subtitles.initialized;
      const hasActiveTrack =
        subtitles.currentTrack !== null && subtitles.currentTrack !== undefined;
      const hasSubtitleUrl = subtitles.subtitlesUrl;
      const hasAvailableTracks =
        subtitles.availableTracks && subtitles.availableTracks.length > 0;
      const hasOctopus = subtitles.octopus;

      if (hasInitializedSubtitles && hasActiveTrack) {
        // Get current track info
        const currentTrack = subtitles.availableTracks[subtitles.currentTrack];
        const language = currentTrack
          ? currentTrack.language ||
            currentTrack.name ||
            `Track ${subtitles.currentTrack + 1}`
          : "Unknown";

        // Clear and rebuild content safely
        subtitleStatusEl.textContent = "";

        const activeSpan = document.createElement("span");
        activeSpan.style.color = "#4caf50";
        activeSpan.textContent = "Active";

        const langSpan = document.createElement("span");
        langSpan.style.color = "#81c784";
        langSpan.textContent = ` (${language})`;

        subtitleStatusEl.appendChild(activeSpan);
        subtitleStatusEl.appendChild(langSpan);
      } else if (hasOctopus && hasSubtitleUrl) {
        // Alternative check - if octopus is loaded and we have a URL
        subtitleStatusEl.textContent = "";

        const loadedSpan = document.createElement("span");
        loadedSpan.style.color = "#4caf50";
        loadedSpan.textContent = "Loaded";

        const octopusSpan = document.createElement("span");
        octopusSpan.style.color = "#81c784";
        octopusSpan.textContent = " (SubtitlesOctopus)";

        subtitleStatusEl.appendChild(loadedSpan);
        subtitleStatusEl.appendChild(octopusSpan);
      } else if (hasAvailableTracks && subtitles.currentTrack === null) {
        subtitleStatusEl.textContent = "";

        const disabledSpan = document.createElement("span");
        disabledSpan.style.color = "#ff9800";
        disabledSpan.textContent = "Disabled";

        const countSpan = document.createElement("span");
        countSpan.style.color = "#ffb74d";
        countSpan.textContent = ` (${subtitles.availableTracks.length} available)`;

        subtitleStatusEl.appendChild(disabledSpan);
        subtitleStatusEl.appendChild(countSpan);
      } else if (hasAvailableTracks) {
        subtitleStatusEl.textContent = "";

        const availableSpan = document.createElement("span");
        availableSpan.style.color = "#2196f3";
        availableSpan.textContent = "Available";

        const tracksSpan = document.createElement("span");
        tracksSpan.style.color = "#64b5f6";
        tracksSpan.textContent = ` (${subtitles.availableTracks.length} tracks)`;

        subtitleStatusEl.appendChild(availableSpan);
        subtitleStatusEl.appendChild(tracksSpan);
      } else {
        subtitleStatusEl.textContent = "No subtitles";
        subtitleStatusEl.style.color = "#ff9800";
      }
    } else {
      subtitleStatusEl.textContent = "Not available";
      subtitleStatusEl.style.color = "#999";
    }

    // Update subtitle progress information
    if (window.player && window.player.subtitlesManager) {
      const subtitles = window.player.subtitlesManager;

      if (subtitles.initialized && subtitles.octopus) {
        // Calculate subtitle content metrics
        const contentLength = subtitles.lastSubtitleContent
          ? subtitles.lastSubtitleContent.length
          : 0;
        const eventCount = subtitles.lastEventCount || 0;
        const contentSizeKB = (contentLength / MEMORY.KB).toFixed(1);

        // Show detailed progress information
        subtitleProgressEl.textContent = "";

        const eventsSpan = document.createElement("span");
        eventsSpan.style.color = "#4caf50";
        eventsSpan.style.paddingLeft = "10px";
        eventsSpan.textContent = `   ${eventCount} events`;

        const sizeSpan = document.createElement("span");
        sizeSpan.style.color = "#81c784";
        sizeSpan.textContent = ` (${contentSizeKB} KB)`;

        subtitleProgressEl.appendChild(eventsSpan);
        subtitleProgressEl.appendChild(sizeSpan);
      } else if (
        subtitles.availableTracks &&
        subtitles.availableTracks.length > 0
      ) {
        // Show loading state
        if (
          subtitles.currentTrack !== null &&
          subtitles.currentTrack !== undefined
        ) {
          subtitleProgressEl.textContent = "";

          const loadingSpan = document.createElement("span");
          loadingSpan.style.color = "#2196f3";
          loadingSpan.textContent = "Loading...";

          const trackSpan = document.createElement("span");
          trackSpan.style.color = "#64b5f6";
          trackSpan.textContent = ` (Track ${subtitles.currentTrack + 1})`;

          subtitleProgressEl.appendChild(loadingSpan);
          subtitleProgressEl.appendChild(trackSpan);
        } else {
          subtitleProgressEl.textContent = "";

          const notLoadedSpan = document.createElement("span");
          notLoadedSpan.style.color = "#ff9800";
          notLoadedSpan.textContent = "Not loaded";

          const availableSpan = document.createElement("span");
          availableSpan.style.color = "#ffb74d";
          availableSpan.textContent = ` (${subtitles.availableTracks.length} available)`;

          subtitleProgressEl.appendChild(notLoadedSpan);
          subtitleProgressEl.appendChild(availableSpan);
        }
      } else {
        subtitleProgressEl.textContent = "No data";
        subtitleProgressEl.style.color = "#999";
      }
    } else {
      subtitleProgressEl.textContent = "Not available";
      subtitleProgressEl.style.color = "#999";
    }

    // Update download progress
    const progressBar = this.elements.progressBar;
    const statusDetails = this.elements.statusDetails;

    if (progressBar && progressBar.style.width) {
      const progress = progressBar.style.width;
      if (
        progress === "100%" ||
        !statusDetails ||
        statusDetails.style.display === "none"
      ) {
        downloadProgressEl.textContent = "Complete";
        downloadProgressEl.style.color = "#4caf50";
      } else {
        downloadProgressEl.textContent = progress;
        downloadProgressEl.style.color = "#2196f3";
      }
    } else {
      downloadProgressEl.textContent = "Not available";
      downloadProgressEl.style.color = "#999";
    }
  }

  // Setup context menu for video element
  setupVideoContextMenu() {
    if (!this.elements.video) {
      if (CONFIG.DEBUG_MODE)
        console.warn("Video element not found for context menu setup");
      return;
    }

    // Remove any existing listeners
    this.elements.video.removeEventListener(
      "contextmenu",
      this.videoContextHandler
    );

    // Create bound handler function
    this.videoContextHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e.clientX, e.clientY);
    };

    this.elements.video.addEventListener(
      "contextmenu",
      this.videoContextHandler
    );

    // Also add to video container
    if (this.elements.videoContainer) {
      this.elements.videoContainer.removeEventListener(
        "contextmenu",
        this.containerContextHandler
      );

      this.containerContextHandler = (e) => {
        // Only show if clicking on the video container itself, video element, or plyr elements
        if (
          e.target === this.elements.videoContainer ||
          e.target === this.elements.video ||
          e.target.closest(".plyr") ||
          e.target.classList.contains("plyr")
        ) {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e.clientX, e.clientY);
        }
      };

      this.elements.videoContainer.addEventListener(
        "contextmenu",
        this.containerContextHandler
      );
    }

    // Also try to add to plyr wrapper when it's created
    setTimeout(() => {
      const plyrWrapper = document.querySelector(".plyr");
      if (plyrWrapper && !plyrWrapper.hasAttribute("data-context-menu-added")) {
        plyrWrapper.setAttribute("data-context-menu-added", "true");
        plyrWrapper.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e.clientX, e.clientY);
        });
      }
    }, UI.CONTEXT_MENU_UPDATE_INTERVAL);
  }

  // Cleanup method for better memory management
  cleanup() {
    // Clear debounce timers
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();

    // Clear DOM cache
    this._domCache.clear();

    // Chrome resource cleanup
    ChromeResourceManager.forceGarbageCollection();

    // Chrome resource cleanup
    ChromeResourceManager.forceGarbageCollection();

    // Remove context menu if exists
    this.removeContextMenu();

    // Clear video context handler
    if (this.videoContextHandler && this.elements.video) {
      this.elements.video.removeEventListener(
        "contextmenu",
        this.videoContextHandler
      );
    }
  }
}

/**
 * Retry Controller - Handles retry logic with exponential backoff
 */
class RetryController {
  constructor(maxRetries = CONFIG.MAX_RETRIES) {
    this.maxRetries = maxRetries;
    this.retryCount = 0;
    this.retryInterval = null;
  }

  // Reset retry state
  reset() {
    this.retryCount = 0;
    this.clearContinuousRetry();
  }

  // Calculate delay for next retry
  getRetryDelay() {
    return Math.min(
      CONFIG.BASE_RETRY_DELAY + this.retryCount * RETRY.DELAY_INCREMENT,
      CONFIG.MAX_RETRY_DELAY
    );
  }

  // Check if we should retry
  shouldRetry() {
    return this.retryCount < this.maxRetries;
  }

  // Execute a retry with delay and exponential backoff
  async executeRetry(retryFn, onStep) {
    if (this.shouldRetry()) {
      this.retryCount++;
      const delay = this.getRetryDelay();

      onStep?.(
        `Retrying video load, attempt ${this.retryCount}/${
          this.maxRetries
        } (waiting ${delay / 1000}s)`
      );

      await this.delay(delay);
      return retryFn();
    } else {
      onStep?.("Max retry attempts reached. Switching to continuous retry...");
      this.startContinuousRetry(retryFn, onStep);
    }
  }

  // Start continuous retrying at a fixed interval
  startContinuousRetry(retryFn, onStep) {
    this.retryInterval = setInterval(() => {
      onStep?.("Continuous retry: Reloading video...");
      retryFn();
    }, CONFIG.CONTINUOUS_RETRY_INTERVAL);
  }

  // Clear the continuous retry interval
  clearContinuousRetry() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  // Delay helper
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Status Poller - Handles torrent status polling
 */
class StatusPoller {
  constructor(magnetUrl) {
    this.magnetUrl = magnetUrl;
    this.isActive = false;
    this.noPeersSince = null;
  }

  // Start polling the server for torrent status
  async start(onStatusUpdate) {
    this.isActive = true;
    let memoryCheckCounter = 0;

    while (this.isActive) {
      // Check memory every 10 polls to prevent Chrome resource exhaustion
      if (memoryCheckCounter++ % 10 === 0) {
        if (ChromeResourceManager.monitorMemory()) {
          console.warn("High memory usage during status polling");
          // Slow down polling when memory is high
          await this.delay(CONFIG.STATUS_POLL_INTERVAL * 2);
          continue;
        }
      }
      try {
        const response = await fetch(
          `/status?url=${encodeURIComponent(this.magnetUrl)}`
        );

        if (response.ok) {
          try {
            const data = await response.json();
            this.updateNoPeersTracking(data);
            onStatusUpdate(data);
          } catch (parseError) {
            console.error("Failed to parse status response:", parseError);
            onStatusUpdate(null, "Failed to parse server response.");
          }
        } else {
          onStatusUpdate(null, "Waiting for torrent status...");
        }
      } catch (error) {
        console.error("Status fetch error:", error);
        onStatusUpdate(null, "Error fetching torrent status.");
      }

      try {
        await this.delay(CONFIG.STATUS_POLL_INTERVAL);
      } catch (delayError) {
        console.error("Delay error in status poller:", delayError);
        break;
      }
    }
  }

  // Stop polling
  stop() {
    this.isActive = false;
  }

  // Track how long we've had no peers
  updateNoPeersTracking(data) {
    if (data.status === "no peers") {
      if (!this.noPeersSince) {
        this.noPeersSince = Date.now();
      }
      data.noPeersSince = this.noPeersSince;
    } else {
      this.noPeersSince = null;
      data.noPeersSince = null;
    }
  }

  // Delay helper
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Resource Loader - Handles loading of video and subtitle resources
 */
class ResourceLoader {
  // Polls a resource URL until it is ready (HTTP 200)
  async pollUntilReady(url, isText = false) {
    for (let i = 0; i < CONFIG.RESOURCE_TIMEOUT; i++) {
      // Show polling message
      if (window.player && window.player.ui) {
        window.player.ui.setStatusMessage(
          `Polling for ${isText ? "subtitles" : "video"}... (attempt ${i + 1})`
        );
      }

      try {
        // Add timestamp for cache busting if URL doesn't already have one
        const urlToFetch = url.includes("_t=")
          ? url
          : url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();

        const response = await fetch(urlToFetch, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        const text = await response.text();
        if (
          response.status === HTTP_STATUS.OK &&
          text !== HTTP_STATUS.NOT_READY
        ) {
          // Resource is ready
          return isText ? text : url;
        } else if (
          response.status === HTTP_STATUS.OK &&
          text === HTTP_STATUS.NOT_READY
        ) {
          // Resource not ready yet, continue polling
        }
      } catch (error) {
        // Network error, continue polling
      }

      await this.delay(RETRY.POLL_DELAY);
    }

    console.error(`[RESOURCE] Timeout waiting for ${url}`);
    throw new Error(`Timeout waiting for ${url}`);
  }

  // Delay helper
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Subtitles Manager - Handles subtitle initialization and updates with multi-track support
 */
class SubtitlesManager {
  constructor(videoElement, magnetUrl) {
    this.videoElement = videoElement;
    this.magnetUrl = magnetUrl;
    this.initialized = false;
    this.octopus = null;
    this.lastSubtitleContent = "";
    this.pollInterval = null;
    this.subtitlesUrl = null;
    this.availableTracks = [];
    this.currentTrack = 0;
    this.subtitleSelector = null;
    this.userSelectedTrack = null;
    this.lastContentHash = null;
    this.lastEventCount = 0;
  }

  // Fetch available subtitle tracks from the server
  async fetchAvailableTracks() {
    try {
      const response = await fetch(
        `/subtitle-tracks?url=${encodeURIComponent(this.magnetUrl)}`
      );
      if (response.ok) {
        this.availableTracks = await response.json();

        // Only create selector if it doesn't exist
        if (!this.subtitleSelector) {
          this.createSubtitleSelector();
        } else {
          this.updateSelectorDisplay();
        }
        return this.availableTracks;
      } else {
        if (CONFIG.DEBUG_MODE)
          console.log(
            "[SUBTITLES] Failed to fetch tracks, status:",
            response.status
          );
      }
    } catch (error) {
      if (CONFIG.DEBUG_MODE)
        console.log("[SUBTITLES] Failed to fetch tracks:", error);
    }
    return [];
  }

  // Create and show subtitle track selector UI
  createSubtitleSelector() {
    // Always show selector to allow users to disable subtitles
    // Remove existing selector if any
    this.removeSubtitleSelector();

    // Create selector container
    const selectorContainer = document.createElement("div");
    selectorContainer.id = "subtitle-selector-container";
    selectorContainer.style.cssText = `
      position: absolute;
      display: none;
      bottom: 60px;
      right: 20px;
      z-index: ${UI.LOADING_OVERLAY_Z_INDEX};
      background: rgba(0, 0, 0, 0.9);
      padding: 8px 0;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 160px;
      max-height: 200px;
      overflow-y: auto;
    `;

    // Add track options or "No subtitles available" message
    if (this.availableTracks.length === 0) {
      const noSubsOption = document.createElement("div");
      noSubsOption.style.cssText = `
        padding: 8px 16px;
        color: rgba(255, 255, 255, 0.6);
        cursor: not-allowed;
      `;
      noSubsOption.textContent = "No subtitles available";
      selectorContainer.appendChild(noSubsOption);
    } else {
      // Add "None" option
      const noneOption = document.createElement("div");
      noneOption.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;
      noneOption.textContent = ""; // Clear any existing content

      const noneText = document.createElement("span");
      noneText.textContent = "None";

      const checkMark = document.createElement("span");
      checkMark.textContent = "✓";
      checkMark.style.marginLeft = "8px";
      checkMark.style.opacity = "0.7";

      noneOption.appendChild(noneText);
      noneOption.appendChild(checkMark);
      noneOption.dataset.value = "none";

      if (this.currentTrack === null) {
        noneOption.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        noneOption.querySelector("span:last-child").style.opacity = "1";
      } else {
        noneOption.querySelector("span:last-child").style.opacity = "0";
      }

      noneOption.addEventListener("mouseenter", () => {
        if (this.currentTrack !== null) {
          noneOption.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        }
      });
      noneOption.addEventListener("mouseleave", () => {
        if (this.currentTrack !== null) {
          noneOption.style.backgroundColor = "transparent";
        }
      });
      noneOption.addEventListener("click", () => {
        this.switchTrack("none");
        // Update selector UI after switching
        setTimeout(() => {
          this.createSubtitleSelector();
        }, 0);
        selectorContainer.style.display = "none";
        // Remove forced controls class when closing selector
        const controlsBar = document.querySelector(".plyr__controls");
        if (controlsBar) controlsBar.classList.remove("plyr-controls-forced");
      });
      selectorContainer.appendChild(noneOption);

      this.availableTracks.forEach((track, index) => {
        const option = document.createElement("div");
        option.style.cssText = `
          padding: 8px 16px;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
        `;
        option.textContent = ""; // Clear any existing content

        const trackSpan = document.createElement("span");
        trackSpan.textContent = `${track.language} - ${track.title}`;

        const checkMarkSpan = document.createElement("span");
        checkMarkSpan.textContent = "✓";
        checkMarkSpan.style.marginLeft = "8px";
        checkMarkSpan.style.opacity = "0.7";

        option.appendChild(trackSpan);
        option.appendChild(checkMarkSpan);
        option.dataset.value = index;

        if (this.currentTrack === index) {
          option.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
          option.querySelector("span:last-child").style.opacity = "1";
        } else {
          option.querySelector("span:last-child").style.opacity = "0";
        }

        option.addEventListener("mouseenter", () => {
          if (this.currentTrack !== index) {
            option.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
          }
        });
        option.addEventListener("mouseleave", () => {
          if (this.currentTrack !== index) {
            option.style.backgroundColor = "transparent";
          }
        });
        option.addEventListener("click", () => {
          this.switchTrack(index.toString());
          // Update selector UI after switching
          setTimeout(() => {
            this.createSubtitleSelector();
          }, 0);
          selectorContainer.style.display = "none";
          // Remove forced controls class when closing selector
          const controlsBar = document.querySelector(".plyr__controls");
          if (controlsBar) controlsBar.classList.remove("plyr-controls-forced");
        });
        selectorContainer.appendChild(option);
      });
    }

    const videoContainer = document.querySelector(".video-container-tag");
    if (videoContainer) {
      videoContainer.appendChild(selectorContainer);
    } else {
      // Try alternative container
      const altContainer =
        document.querySelector("#video-container") ||
        document.querySelector(".plyr");
      if (altContainer) {
        altContainer.appendChild(selectorContainer);
      } else {
        if (CONFIG.DEBUG_MODE)
          console.log("No suitable container found for subtitle selector");
      }
    }

    // Close selector when clicking outside
    setTimeout(() => {
      function handleOutsideClick(event) {
        const selector = document.getElementById("subtitle-selector-container");
        const ccBtn = document.getElementById("plyr-subtitles-btn");
        if (
          selector &&
          selector.style.display !== "none" &&
          !selector.contains(event.target) &&
          (!ccBtn || !ccBtn.contains(event.target))
        ) {
          selector.style.display = "none";
          // Restore CC button if you hide it when selector is open
          if (ccBtn) ccBtn.style.display = "";
          // Remove forced controls class
          const controlsBar = document.querySelector(".plyr__controls");
          if (controlsBar) controlsBar.classList.remove("plyr-controls-forced");
          document.removeEventListener("mousedown", handleOutsideClick);
        }
      }
      document.addEventListener("mousedown", handleOutsideClick);
    }, 0);

    // Create subtitle button if it doesn't exist
    if (!document.getElementById("plyr-subtitles-btn")) {
      const subtitlesBtn = document.createElement("button");
      subtitlesBtn.id = "plyr-subtitles-btn";
      subtitlesBtn.className = "plyr__control plyr__subtitles-btn";
      subtitlesBtn.type = "button";
      subtitlesBtn.setAttribute("aria-label", "Subtitles");

      // Create SVG securely with DOM methods
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", "32");
      svg.setAttribute("height", "32");
      svg.setAttribute("viewBox", "0 0 32 32");

      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("id", "cc");

      const path1 = document.createElementNS(svgNS, "path");
      path1.setAttribute("fill", "#ffffffff");
      path1.setAttribute(
        "d",
        "M14,23H6a3,3,0,0,1-3-3V13a3,3,0,0,1,3-3h8a1,1,0,0,1,0,2H6a1,1,0,0,0-1,1v7a1,1,0,0,0,1,1h8a1,1,0,0,1,0,2Z"
      );

      const path2 = document.createElementNS(svgNS, "path");
      path2.setAttribute("fill", "#ffffffff");
      path2.setAttribute(
        "d",
        "M28,23H20a3,3,0,0,1-3-3V13a3,3,0,0,1,3-3h8a1,1,0,0,1,0,2H20a1,1,0,0,0-1,1v7a1,1,0,0,0,1,1h8a1,1,0,0,1,0,2Z"
      );

      g.appendChild(path1);
      g.appendChild(path2);
      svg.appendChild(g);
      subtitlesBtn.appendChild(svg);

      // Style the button
      subtitlesBtn.style.cssText = `
        margin: 0 8px;
        background: none;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px;
        border-radius: 4px;
        color: #fff;
        transition: all 0.2s ease;
      `;

      // Add hover effects
      let isHovered = false;
      subtitlesBtn.addEventListener("mouseenter", () => {
        if (!isHovered) {
          isHovered = true;
          subtitlesBtn.style.background = "rgba(35, 40, 47, 0.95)";
        }
      });
      subtitlesBtn.addEventListener("mouseleave", () => {
        if (isHovered) {
          isHovered = false;
          subtitlesBtn.style.background = "none";
        }
      });

      // Click handler
      subtitlesBtn.addEventListener("click", () => {
        const selector = document.getElementById("subtitle-selector-container");
        if (selector) {
          const isVisible = selector.style.display !== "block";
          selector.style.display = isVisible ? "block" : "none";
        }
      });

      // Add to Plyr controls
      addToPlyrControlsBar(subtitlesBtn, {
        before: '[data-plyr="fullscreen"]',
      });
    }
  }

  // Remove subtitle selector UI
  removeSubtitleSelector() {
    const existingBtn = document.getElementById("plyr-subtitles-btn");
    const existing = document.getElementById("subtitle-selector-container");
    if (existingBtn) existingBtn.remove();
    if (existing) {
      existing.remove();
    }
  }

  // Update the selector to reflect current track
  updateSelectorDisplay() {
    if (this.subtitleSelector) {
      if (this.currentTrack === null) {
        this.subtitleSelector.value = "none";
      } else {
        this.subtitleSelector.value = this.currentTrack.toString();
      }
    }
  }

  // Switch to a different subtitle track
  async switchTrack(trackValue) {
    // Show loading overlay with black background
    const video = this.videoElement;
    if (video) {
      video.pause();
      video.classList.add("blurred-for-subtitles-loading");
    }
    let overlay = document.getElementById("subtitles-loading-overlay");
    const plyrContainer =
      document.querySelector(".plyr") ||
      document.getElementById("video-container");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "subtitles-loading-overlay";
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.background = "rgba(17, 17, 17, 0.5)";
      overlay.style.zIndex = "99999";
      overlay.style.display = "flex";
      overlay.style.flexDirection = "column";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.textContent = ""; // Clear any existing content

      const spinnerDiv = document.createElement("div");
      spinnerDiv.style.width = "64px";
      spinnerDiv.style.height = "64px";
      spinnerDiv.style.borderRadius = "12px";
      spinnerDiv.style.background = "none";
      spinnerDiv.style.display = "flex";
      spinnerDiv.style.alignItems = "center";
      spinnerDiv.style.justifyContent = "center";

      const loadingTextDiv = document.createElement("div");
      loadingTextDiv.style.marginTop = "24px";
      loadingTextDiv.style.color = "#fff";
      loadingTextDiv.style.fontSize = "22px";
      loadingTextDiv.textContent = "Loading subtitles...";

      overlay.appendChild(spinnerDiv);
      overlay.appendChild(loadingTextDiv);
      if (plyrContainer) {
        plyrContainer.appendChild(overlay);
      } else {
        document.body.appendChild(overlay);
      }
    } else {
      overlay.style.display = "flex";
    }
    if (!document.getElementById("subtitles-spinner-style")) {
      const style = document.createElement("style");
      style.id = "subtitles-spinner-style";
      style.textContent = `.blurred-for-subtitles-loading {  filter: blur(6px) brightness(0.7); }`;
      document.head.appendChild(style);
    }
    // Always fully dispose previous SubtitlesOctopus instance and remove canvas
    if (this.octopus) {
      try {
        this.octopus.dispose();
      } catch (e) {}
      this.octopus = null;
    }
    this.initialized = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    const oldCanvas = document.querySelector(".libassjs-canvas");
    if (oldCanvas) oldCanvas.remove();

    if (trackValue === "none") {
      this.currentTrack = null;
      this.userSelectedTrack = null;
      this.updateSelectorDisplay();
      // No subtitles: ensure disposed and canvas removed
      this.dispose();
      const octopusCanvas = document.querySelector(".libassjs-canvas");
      if (octopusCanvas) octopusCanvas.remove();
      // Hide overlay and remove blur after switching to "none"
      if (overlay) overlay.style.display = "none";
      if (video) video.classList.remove("blurred-for-subtitles-loading");
      if (video && video.paused) video.play();
      return;
    }

    // Parse and validate track index
    // Only declare variables once

    var trackIndex = parseInt(trackValue, 10);
    if (isNaN(trackIndex) || trackIndex >= this.availableTracks.length) {
      // Hide overlay and remove blur if invalid track
      if (overlay) overlay.style.display = "none";
      if (video) video.classList.remove("blurred-for-subtitles-loading");
      if (video && video.paused) video.play();
      return;
    }

    this.currentTrack = trackIndex;
    this.userSelectedTrack = trackIndex;
    this.updateSelectorDisplay();

    var subtitlesUrl = `/subtitles?url=${encodeURIComponent(
      this.magnetUrl
    )}&track=${trackIndex}`;

    try {
      // Wait a bit before first request to ensure subtitles are ready
      await new Promise((res) => setTimeout(res, 500));

      // Repeatedly request subtitles until loaded
      let loaded = false;
      let attempts = 0;
      while (!loaded && attempts < 20) {
        attempts++;
        try {
          // Add timestamp to bypass cache
          const urlWithTimestamp = subtitlesUrl + "&_t=" + Date.now();
          const response = await fetch(urlWithTimestamp, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          });
          if (response.ok) {
            const subtitleContent = await response.text();
            if (
              subtitleContent &&
              subtitleContent.length > 10 &&
              subtitleContent.indexOf("[Script Info]") !== -1
            ) {
              this.dispose();
              const canvas = document.querySelector(".libassjs-canvas");
              if (canvas) canvas.remove();
              await this.initialize(subtitleContent, subtitlesUrl);
              this.updateSelectorDisplay();
              loaded = true;
              break;
            }
          }
        } catch (err) {
          // Ignore and retry
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
      // Hide overlay and remove blur after loading
      if (overlay) overlay.style.display = "none";
      if (video) video.classList.remove("blurred-for-subtitles-loading");
      if (video && video.paused) video.play();
    } catch (error) {
      if (CONFIG.DEBUG_MODE)
        console.error("Failed to load subtitle track:", error);
      // Hide overlay and remove blur on error
      if (overlay) overlay.style.display = "none";
      if (video) video.classList.remove("blurred-for-subtitles-loading");
      if (video && video.paused) video.play();
    }
  }

  // Initialize subtitles rendering (ASS/SSA) with track support
  async initialize(subtitleContent, subtitlesUrl) {
    this.subtitlesUrl = subtitlesUrl;
    this.lastSubtitleContent = subtitleContent;
    this.lastContentHash = this.calculateContentHash(subtitleContent);
    this.lastEventCount = this.countSubtitleEvents(subtitleContent);

    if (!subtitleContent || subtitleContent.indexOf("[Script Info]") === -1) {
      // Handle VTT fallback if needed
      return;
    }

    if (typeof window.SubtitlesOctopus !== "undefined") {
      // Get screen dimensions for proper sizing
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const videoRect = this.videoElement.getBoundingClientRect();

      this.octopus = new window.SubtitlesOctopus({
        video: this.videoElement,
        subContent: subtitleContent,
        workerUrl: "/libs/octopus/subtitles-octopus-worker.js",
        fonts: ["/libs/fonts/ARIALBD.TTF", "/libs/fonts/NotoSansJP-Bold.ttf"],
        fallbackFont: "/libs/fonts/ARIALBD.TTF",
        renderMode: "wasm-blend",
        targetFps: 24,
        // Enhanced sizing configuration
        prescaleFactor: 1.0,
        prescaleHeightLimit: screenHeight,
        maxRenderHeight: screenHeight,
        // Dynamic sizing based on screen
        onReady: () => {
          if (this.octopus && this.octopus.setTargetSize) {
            // Set target size for proper scaling
            this.octopus.setTargetSize(videoRect.width, videoRect.height);
          }
        },
        // Handle fullscreen changes
        onFullscreenChange: (isFullscreen) => {
          if (this.octopus && this.octopus.setTargetSize) {
            if (isFullscreen) {
              this.octopus.setTargetSize(screenWidth, screenHeight);
            } else {
              const newRect = this.videoElement.getBoundingClientRect();
              this.octopus.setTargetSize(newRect.width, newRect.height);
            }
          }
        },
      });
      this.initialized = true;
      this.startPollingForUpdates();
    } else {
      console.error("SubtitlesOctopus not loaded!");
      this.ui.showError(
        "Subtitle engine failed to load. Video will play without subtitles."
      );
      return false;
    }
  }

  // Poll for subtitle updates and reload if changed
  startPollingForUpdates() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      if (!this.subtitlesUrl) return;
      try {
        // Add timestamp to URL to bypass cache
        const urlWithTimestamp =
          this.subtitlesUrl +
          (this.subtitlesUrl.includes("?") ? "&" : "?") +
          "_t=" +
          Date.now();
        const response = await fetch(urlWithTimestamp, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        if (response.status === 200) {
          const newContent = await response.text();

          // Smart update logic - only refresh if meaningful changes detected
          if (this.shouldUpdateSubtitles(newContent)) {
            await this.updateSubtitlesSmartly(newContent);
          }
        }
      } catch (e) {
        if (CONFIG.DEBUG_MODE)
          console.warn("Failed to poll for subtitle updates:", e);
      }
    }, 3000); // Check every 3 seconds to reduce unnecessary requests
  }

  // Determine if subtitle content has meaningful changes
  shouldUpdateSubtitles(newContent) {
    // Don't update if content is identical
    if (newContent === this.lastSubtitleContent) {
      return false;
    }

    // Don't update if content is shorter (likely incomplete)
    if (newContent.length < this.lastSubtitleContent.length) {
      return false;
    }

    // Calculate a simple hash of the content for comparison
    const newHash = this.calculateContentHash(newContent);
    if (newHash === this.lastContentHash) {
      return false;
    }

    // Count subtitle events to detect meaningful additions
    const newEventCount = this.countSubtitleEvents(newContent);
    const eventDifference = newEventCount - this.lastEventCount;

    // Only update if we have significant new content (more than 2 new events or 10% more content)
    const contentGrowth =
      (newContent.length - this.lastSubtitleContent.length) /
      this.lastSubtitleContent.length;

    if (eventDifference >= 2 || contentGrowth > 0.1) {
      return true;
    }

    return false;
  }

  // Calculate a simple hash for content comparison
  calculateContentHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Count subtitle events (dialogue lines) in ASS/SSA content
  countSubtitleEvents(content) {
    const dialogueMatches = content.match(/^Dialogue:/gm);
    return dialogueMatches ? dialogueMatches.length : 0;
  }

  // Smart subtitle update that preserves video state
  async updateSubtitlesSmartly(newContent) {
    // Store current video state
    const currentTime = this.videoElement.currentTime;
    const wasPaused = this.videoElement.paused;

    // Update tracking variables
    this.lastContentHash = this.calculateContentHash(newContent);
    this.lastEventCount = this.countSubtitleEvents(newContent);
    this.lastSubtitleContent = newContent;

    // Only reinitialize if SubtitlesOctopus doesn't support hot reload
    if (this.octopus && typeof this.octopus.setTrack === "function") {
      // If octopus supports hot reload, use it
      try {
        this.octopus.setTrack(newContent);
        return;
      } catch (e) {
        if (CONFIG.DEBUG_MODE)
          console.log("Hot reload failed, falling back to full reload:", e);
      }
    }

    // Fall back to full reload but preserve state
    try {
      // Temporarily hide octopus canvas to prevent flicker
      const canvas = document.querySelector(".libassjs-canvas");
      if (canvas) {
        canvas.style.opacity = "0";
      }

      this.dispose();
      await this.initialize(newContent, this.subtitlesUrl);

      // Restore video state after a brief delay
      setTimeout(() => {
        if (!wasPaused && this.videoElement.paused) {
          this.videoElement.play();
        }
        this.videoElement.currentTime = currentTime;

        // Restore canvas visibility
        if (canvas) {
          canvas.style.opacity = "1";
        }
      }, 100);
    } catch (error) {
      if (CONFIG.DEBUG_MODE)
        console.error("Failed to update subtitles:", error);
      // Restore canvas visibility on error
      const canvas = document.querySelector(".libassjs-canvas");
      if (canvas) {
        canvas.style.opacity = "1";
      }
    }
  }

  // Dispose of the subtitles renderer and polling
  dispose() {
    if (this.octopus) {
      this.octopus.dispose();
      this.octopus = null;
    }
    this.initialized = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Clean up all subtitle-related UI and resources
  cleanup() {
    this.dispose();
    this.removeSubtitleSelector();
  }
}

/**
 * Main Video Player Controller
 */
class VideoPlayerController {
  previousDuration = null;
  originalDuration = null; // Store duration from first successful load
  // Suppress resume prompt for next video load (e.g., after audio switch)
  suppressResumePromptForNextLoad() {
    this._suppressResumePrompt = true;
    setTimeout(() => {
      this._suppressResumePrompt = false;
    }, 2000); // Reset after 2 seconds
  }
  // Switch audio track and reload video source
  async switchAudioTrack(trackIndex) {
    // Store previous duration before switching, only if finite
    if (video && isFinite(video.duration)) {
      this.previousDuration = video.duration;
    }
    const video = this.ui.elements.video;
    if (!video) return;
    // Save current time and paused state
    const currentTime = video.currentTime;
    const wasPaused = video.paused;
    // Suppress resume prompt before switching audio
    this.suppressResumePromptForNextLoad();
    // Build new video URL with audioTrack param
    const magnetUrl = this.magnetUrl;
    let videoUrl = `/video?url=${encodeURIComponent(magnetUrl)}`;
    if (trackIndex && trackIndex !== "0") {
      videoUrl += `&audioTrack=${trackIndex}`;
    }
    // Set new src and reload
    video.src = videoUrl;
    video.load();
    // Restore time and play state after loadedmetadata
    video.onloadedmetadata = () => {
      // Check if sources match
      const sourcesMatch = video.src.includes(videoUrl);
      if (CONFIG.DEBUG_MODE) {
        console.log(`[AUDIO] Sources match: ${sourcesMatch}`);
        if (!sourcesMatch) {
          console.warn(
            `[AUDIO] Video src mismatch! Expected: ${videoUrl}, Actual: ${video.src}`
          );
        }
      }

      // Wait for canplay event before seeking to ensure stream is ready
      const onCanPlay = () => {
        video.currentTime = currentTime;
        if (CONFIG.DEBUG_MODE) {
          console.log(`[AUDIO] Restored playback position to: ${currentTime}s`);
        }
        if (!wasPaused) {
          video.play().catch((e) => {
            if (CONFIG.DEBUG_MODE)
              console.warn("[AUDIO] Play failed after switch:", e);
          });
        }
        video.removeEventListener("canplay", onCanPlay);
      };

      video.addEventListener("canplay", onCanPlay);

      // Re-enable resume prompt after audio switch
      setTimeout(() => {
        this._suppressResumePrompt = false;
      }, 1000);
      video.onloadedmetadata = null;
    };
  }
  constructor(magnetUrl) {
    // Validate magnet URL before proceeding
    if (!isValidMagnet(magnetUrl)) {
      console.error("Invalid or missing magnet URL provided:", magnetUrl);
      this.error = "Invalid or missing magnet URL provided";
      return;
    }

    this._suppressResumePrompt = false;
    this.magnetUrl = magnetUrl;
    this.playerReadyKey = `playerReady_${magnetUrl}`;
    this.resumeTimeKey = `resumeTime_${magnetUrl}`;

    // Initialize components
    this.ui = new UIController();
    this.retryController = new RetryController();
    this.statusPoller = new StatusPoller(magnetUrl);
    this.resourceLoader = new ResourceLoader();
    this.subtitlesManager = new SubtitlesManager(
      this.ui.elements.video,
      magnetUrl
    );
    this.audioManager = new AudioManager(magnetUrl);

    // State
    this.playerInitialized = false;
    this.playerStarted = false;
    this.plyrInstance = null;

    // Apply Plyr theme from config
    this.applyPlyrTheme();
    this.subtitlesLoaded = false; // Track if subtitles are loaded
    this.audioTracksLoaded = false; // Track if audio tracks are loaded
    this.currentAudioTrack = 0; // Current audio track index
    this.hasSeenDownloadProgress = false; // Track if we've seen any download progress

    // Show/hide watermark based on config
    const watermark = document.querySelector(".video-watermark");
    if (watermark) {
      watermark.style.display = CONFIG.WATERMARK ? "" : "none";
      if (CONFIG.WATERMARK_CONTENT) {
        watermark.textContent = CONFIG.WATERMARK_CONTENT;
      }
    }

    this.bindEvents();
    this.checkInitialState();

    // Add global error handlers to prevent STATUS_BREAKPOINT
    this.setupGlobalErrorHandlers();

    // Setup periodic memory monitoring (every 30 seconds)
    this.memoryMonitorInterval = setInterval(() => {
      if (ChromeResourceManager.monitorMemory()) {
        console.warn("High memory usage detected during playback");
        // Reduce video quality or perform other optimizations
        if (this.ui.elements.video) {
          ChromeResourceManager.optimizeVideo(this.ui.elements.video);
        }
      }
    }, 30000);

    // Initialize fullscreen controller
    this.fullscreenController = new FullscreenController();

    // Listen for localStorage changes from other tabs/windows
    this.setupCrossTabCleanup();
  }

  // Setup global error handlers to prevent STATUS_BREAKPOINT errors
  setupGlobalErrorHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener("error", (event) => {
      console.error("Global error caught:", event.error);

      // Check if error is memory-related
      const isMemoryError =
        event.error?.message?.includes("memory") ||
        event.error?.message?.includes("Maximum call stack") ||
        event.error?.name === "RangeError";

      if (isMemoryError || ChromeResourceManager.monitorMemory()) {
        console.warn("Memory-related error detected, forcing cleanup");
        ChromeResourceManager.forceGarbageCollection();
      }

      if (CONFIG.DEBUG_MODE) {
        console.error("Error details:", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        });
      }

      // Prevent default error handling that might cause STATUS_BREAKPOINT
      event.preventDefault();

      // Show user-friendly error
      if (this.ui) {
        this.ui.showError(
          "An unexpected error occurred. Please refresh the page."
        );
      }
    });

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      if (CONFIG.DEBUG_MODE) {
        console.error("Promise rejection details:", event);
      }

      // Prevent default handling
      event.preventDefault();

      // Show user-friendly error
      if (this.ui && !event.reason?.message?.includes("fetch")) {
        this.ui.showError("A network or processing error occurred.");
      }
    });
  }

  // Setup cross-tab localStorage cleanup detection
  setupCrossTabCleanup() {
    window.addEventListener("storage", (e) => {
      // Check if our specific keys were removed by another tab
      if (e.key === this.playerReadyKey && e.newValue === null) {
        if (CONFIG.DEBUG_MODE)
          console.log(
            "Another tab cleaned up this magnet, cleaning up localStorage"
          );
        this.clearLocalStorageData();
        this.ui.showError(
          "Files were deleted from another tab. Please reload."
        );
        this.statusPoller.stop();
      }
    });
  }

  // Bind UI and video events
  bindEvents() {
    // Bind UI events
    this.ui.onRetryClick = () => this.handleManualRetry();
    this.ui.onResumeClick = () => this.handleResumeClick();
    this.ui.onRestartClick = () => this.handleRestartClick();

    // Video events with passive listeners for better performance
    const video = this.ui.elements.video;
    const passiveOptions = { passive: true };

    video.addEventListener("error", () => {
      try {
        this.handleVideoError();
      } catch (error) {
        console.error("Error in video error handler:", error);
        this.ui.showError("Critical video error occurred. Please refresh.");
      }
    });
    video.addEventListener(
      "canplay",
      () => {
        try {
          this.handleVideoCanPlay();
        } catch (error) {
          console.error("Error in canplay handler:", error);
        }
      },
      passiveOptions
    );
    video.addEventListener(
      "loadstart",
      () => this.handleVideoLoadStart(),
      passiveOptions
    );
    video.addEventListener(
      "loadedmetadata",
      () => this.handleVideoLoadedMetadata(),
      passiveOptions
    );
    video.addEventListener(
      "loadeddata",
      () => this.handleVideoLoadedData(),
      passiveOptions
    );
    video.addEventListener(
      "canplaythrough",
      () => this.handleVideoCanPlayThrough(),
      passiveOptions
    );

    // Debounced timeupdate for better performance
    let lastSaveTime = 0;
    video.addEventListener(
      "timeupdate",
      () => {
        try {
          const now = Date.now();
          // Only save every 2 seconds to reduce localStorage writes
          if (now - lastSaveTime > 2000) {
            const t = video.currentTime;
            const duration = video.duration;
            // Only save if playing, time > 0, and not at end
            if (!video.paused && t > 0 && t < duration - 1) {
              try {
                localStorage.setItem(this.resumeTimeKey, t.toFixed(2));
                lastSaveTime = now;
              } catch (storageError) {
                console.warn("Failed to save resume time:", storageError);
                // Don't update lastSaveTime so it will retry later
              }
            }
          }
        } catch (error) {
          console.warn("Error in timeupdate handler:", error);
        }
      },
      passiveOptions
    );

    // Cleanup on page leave - multiple events to ensure it triggers (if manual cleanup is enabled)
    if (CONFIG.MANUAL_CLEANUP) {
      const cleanupAll = () => {
        this.cleanup();
        // Also clean localStorage for this magnet globally
        window.cleanLocalStorageForMagnet?.(this.magnetUrl);
      };
      // Use passive listeners for better performance
      window.addEventListener("beforeunload", cleanupAll, { passive: true });
      window.addEventListener("pagehide", cleanupAll, { passive: true });
      window.addEventListener("unload", cleanupAll, { passive: true });
      if (CONFIG.DEBUG_MODE)
        console.log(
          "Manual cleanup enabled - files will be deleted when player is closed"
        );
    } else {
      if (CONFIG.DEBUG_MODE)
        console.log(
          `Manual cleanup disabled - files will auto-delete after ${CONFIG.AUTO_DELETE_HOURS} hours`
        );
    }
  }

  // Check if player was previously marked as ready (for fast reload)
  checkInitialState() {
    if (localStorage.getItem(this.playerReadyKey) === "1") {
      document.addEventListener("DOMContentLoaded", () => {
        this.ui.hideLoading();
        this.ui.elements.video.style.display = "";
      });
    }
  }

  // Initialize the player and start loading resources
  // Apply Plyr theme colors as CSS custom properties
  applyPlyrTheme() {
    const root = document.documentElement;

    root.style.setProperty("--plyr-color-main", PLYR_THEME.primaryColor);
    root.style.setProperty(
      "--plyr-video-background",
      PLYR_THEME.videoBackground
    );
    root.style.setProperty("--plyr-menu-background", PLYR_THEME.menuBackground);
    root.style.setProperty("--plyr-menu-shadow", PLYR_THEME.menuShadow);
    root.style.setProperty("--plyr-menu-color", PLYR_THEME.textColor);
    root.style.setProperty("--plyr-video-control-color", PLYR_THEME.textColor);
    root.style.setProperty(
      "--plyr-video-control-color-hover",
      PLYR_THEME.textColor
    );
    root.style.setProperty(
      "--plyr-video-control-background-hover",
      PLYR_THEME.controlBackgroundHover
    );
    root.style.setProperty(
      "--plyr-tooltip-background",
      PLYR_THEME.tooltipBackground
    );
    root.style.setProperty("--plyr-tooltip-color", PLYR_THEME.tooltipColor);
    root.style.setProperty("--plyr-control-icon-size", PLYR_THEME.iconSize);
    root.style.setProperty(
      "--plyr-control-icon-size-large",
      PLYR_THEME.iconSizeLarge || "24px"
    );
    root.style.setProperty("--plyr-control-spacing", "8px"); // REDUCED FROM 10px
    root.style.setProperty("--plyr-control-radius", PLYR_THEME.borderRadius);

    // CRITICAL: Apply control size and reduced range sizing
    root.style.setProperty("--plyr-control-size", PLYR_THEME.controlSize);
    root.style.setProperty("--plyr-range-track-height", "4px"); // REDUCED FROM 5px
    root.style.setProperty("--plyr-range-thumb-height", "10px"); // REDUCED FROM 13px
    root.style.setProperty("--plyr-range-thumb-width", "10px"); // NEW: explicit thumb width

    root.style.setProperty(
      "--plyr-range-fill-background",
      PLYR_THEME.primaryColor
    );
    root.style.setProperty(
      "--plyr-video-progress-buffered-background",
      PLYR_THEME.bufferColor
    );
    root.style.setProperty(
      "--plyr-range-track-background",
      PLYR_THEME.sliderTrackColor
    );
    root.style.setProperty(
      "--plyr-video-controls-background",
      PLYR_THEME.controlBackground
    );
    root.style.setProperty(
      "--plyr-badge-background",
      PLYR_THEME.badgeBackground
    );
    root.style.setProperty(
      "--plyr-badge-text-color",
      PLYR_THEME.badgeTextColor
    );
    root.style.setProperty("--plyr-tab-focus-color", PLYR_THEME.focusColor);
    root.style.setProperty("--plyr-font-family", PLYR_THEME.fontFamily);
    root.style.setProperty("--plyr-font-size-small", PLYR_THEME.fontSizeSmall);
    root.style.setProperty("--plyr-font-size-base", PLYR_THEME.fontSizeBase);
    root.style.setProperty("--plyr-font-size-large", PLYR_THEME.fontSizeLarge);

    // NEW: Additional control bar sizing
    root.style.setProperty("--plyr-video-controls-height", "36px"); // NEW: explicit controls height
    root.style.setProperty("--plyr-control-padding", "4px 6px"); // NEW: reduced control padding
  }

  // Fix Plyr icons with proper SVG definitions (secure DOM manipulation)
  fixPlyrIcons() {
    setTimeout(() => {
      const container = document.querySelector(".plyr");
      if (!container) return;

      // Helper function to create SVG elements safely
      const createSVGElement = (tag, attributes = {}) => {
        const element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          tag
        );
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
        return element;
      };

      // Fix play button (triangle) - clear all content and add single SVG
      const playBtn = container.querySelector('[data-plyr="play"]');
      if (playBtn) {
        // Clear existing content
        while (playBtn.firstChild) {
          playBtn.removeChild(playBtn.firstChild);
        }
        const svg = createSVGElement("svg", {
          viewBox: "0 0 24 24",
          width: "18",
          height: "18",
        });
        const polygon = createSVGElement("polygon", {
          points: "5,2 19,12 5,22",
          fill: "currentColor",
        });
        svg.appendChild(polygon);
        playBtn.appendChild(svg);
      }

      // Fix large play button (triangle) - clear all content and add single SVG
      const playLargeBtn = container.querySelector('[data-plyr="play-large"]');
      if (playLargeBtn) {
        while (playLargeBtn.firstChild) {
          playLargeBtn.removeChild(playLargeBtn.firstChild);
        }
        const svg = createSVGElement("svg", {
          viewBox: "0 0 24 24",
          width: "28",
          height: "28",
        });
        const polygon = createSVGElement("polygon", {
          points: "8,5 19,12 8,19",
          fill: "currentColor",
        });
        svg.appendChild(polygon);
        playLargeBtn.appendChild(svg);
      }

      // Fix pause button - clear all content and add single SVG
      const pauseBtn = container.querySelector('[data-plyr="pause"]');
      if (pauseBtn) {
        while (pauseBtn.firstChild) {
          pauseBtn.removeChild(pauseBtn.firstChild);
        }
        const svg = createSVGElement("svg", {
          viewBox: "0 0 24 24",
          width: "18",
          height: "18",
        });
        const rect1 = createSVGElement("rect", {
          x: "6",
          y: "4",
          width: "4",
          height: "16",
          fill: "currentColor",
        });
        const rect2 = createSVGElement("rect", {
          x: "14",
          y: "4",
          width: "4",
          height: "16",
          fill: "currentColor",
        });
        svg.appendChild(rect1);
        svg.appendChild(rect2);
        pauseBtn.appendChild(svg);
      }

      // Fix mute button (volume icon) - clear all content and add single SVG
      const muteBtn = container.querySelector('[data-plyr="mute"]');
      if (muteBtn) {
        while (muteBtn.firstChild) {
          muteBtn.removeChild(muteBtn.firstChild);
        }
        const svg = createSVGElement("svg", {
          viewBox: "0 0 24 24",
          width: "18",
          height: "18",
        });
        const polygon = createSVGElement("polygon", {
          points: "11,5 6,9 2,9 2,15 6,15 11,19",
          fill: "currentColor",
        });
        const path1 = createSVGElement("path", {
          d: "M19.07,4.93C20.98,6.84 22,9.35 22,12s-1.02,5.16-2.93,7.07l-1.41-1.41C19.59,15.73 20.5,13.95 20.5,12s-0.91-3.73-2.84-5.66L19.07,4.93z",
          fill: "currentColor",
        });
        svg.appendChild(polygon);
        svg.appendChild(path1);
        muteBtn.appendChild(svg);
      }

      // Fix fullscreen button (single icon) - clear all content and add single SVG
      const fullscreenBtn = container.querySelector('[data-plyr="fullscreen"]');
      if (fullscreenBtn) {
        while (fullscreenBtn.firstChild) {
          fullscreenBtn.removeChild(fullscreenBtn.firstChild);
        }
        const svg = createSVGElement("svg", {
          viewBox: "0 0 24 24",
          width: "18",
          height: "18",
        });
        const path = createSVGElement("path", {
          d: "M7,14H5v5h5v-2H7V14z M5,10h2V7h3V5H5V10z M17,17h-3v2h5v-5h-2V17z M14,5v2h3v3h2V5H14z",
          fill: "currentColor",
        });
        svg.appendChild(path);
        fullscreenBtn.appendChild(svg);
      }

      // Also fix any duplicate controls that might exist
      const allControls = container.querySelectorAll(".plyr__control");
      allControls.forEach((control) => {
        const svgs = control.querySelectorAll("svg");
        if (svgs.length > 1) {
          // Remove all but the first SVG
          for (let i = 1; i < svgs.length; i++) {
            svgs[i].remove();
          }
        }
      });
    }, 100);
  }

  async initialize() {
    try {
      // Check if there was a constructor error
      if (this.error) {
        this.handleInitializationError(new Error(this.error));
        return;
      }

      await this.startPlayer();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  // Handle initialization errors gracefully
  handleInitializationError(error) {
    console.error("Player initialization failed:", error);

    // Show user-friendly error message
    if (this.ui) {
      this.ui.showError(`Failed to initialize player: ${error.message}`);
      this.ui.hidePlyrLoadingOverlay();
    } else {
      // Fallback if UI is not available
      const overlay = document.getElementById("plyr-loading-overlay");
      if (overlay) {
        // Clear existing content safely
        overlay.textContent = "";

        // Create error container
        const errorContainer = document.createElement("div");
        errorContainer.style.textAlign = "center";
        errorContainer.style.color = "#fff";
        errorContainer.style.padding = "20px";

        // Create icon
        const iconDiv = document.createElement("div");
        iconDiv.textContent = "⚠️";
        iconDiv.style.fontSize = "2em";
        iconDiv.style.marginBottom = "10px";

        // Create title
        const titleDiv = document.createElement("div");
        titleDiv.textContent = "Player Error";
        titleDiv.style.fontSize = "1.2em";
        titleDiv.style.marginBottom = "10px";

        // Create message
        const messageDiv = document.createElement("div");
        messageDiv.textContent = error.message || "Unknown error occurred";
        messageDiv.style.opacity = "0.8";

        errorContainer.appendChild(iconDiv);
        errorContainer.appendChild(titleDiv);
        errorContainer.appendChild(messageDiv);

        overlay.appendChild(errorContainer);
        overlay.style.display = "flex";
      }
    }
  }

  // Start the player, load video and subtitles, and initialize Plyr
  async startPlayer() {
    // Prevent double initialization
    if (this.playerStarted) return;
    this.playerStarted = true;

    this.ui.showStep("Initializing player...");

    if (this.playerInitialized) {
      this.ui.showVideoContainer();
      this.ui.hidePlyrLoadingOverlay();
      return;
    }

    this.ui.showVideoContainer();
    this.ui.showPlyrLoadingOverlay();

    // Start status polling
    this.statusPoller.start((data, errorMsg) => {
      this.handleStatusUpdate(data, errorMsg);
    });

    try {
      // Load resources
      const videoUrl = `/video?url=${encodeURIComponent(this.magnetUrl)}`;
      const subtitlesUrl = `/subtitles?url=${encodeURIComponent(
        this.magnetUrl
      )}`;
      this.ui.showStep("Loading video and subtitles...");

      const [videoSrc, subtitleContent] = await Promise.all([
        this.resourceLoader.pollUntilReady(videoUrl, false),
        this.resourceLoader
          .pollUntilReady(subtitlesUrl, true)
          .catch(() => null), // Don't throw if subtitles not ready
      ]);

      this.ui.showStep("Video and subtitles are ready (or video only)");

      // Set up video with error handling and resource optimization
      try {
        // Apply Chrome optimizations before loading
        ChromeResourceManager.optimizeVideo(this.ui.elements.video);

        this.ui.elements.video.src = videoSrc;
        this.ui.elements.video.load();
      } catch (videoError) {
        console.error("Error setting video source:", videoError);
        this.ui.showError(`Failed to load video: ${videoError.message}`);
        throw videoError;
      }

      // Initialize Plyr player if not already done
      if (!this.playerInitialized) {
        try {
          this.plyrInstance = new Plyr(this.ui.elements.video, PLYR_CONFIG);
          this.playerInitialized = true;

          // Fix Plyr icons after initialization
          this.fixPlyrIcons();

          // Add error handling for Plyr events
          if (this.plyrInstance) {
            this.plyrInstance.on("error", (event) => {
              console.error("Plyr error:", event);
              this.ui.showError("Video player error occurred.");
            });
          }
        } catch (error) {
          console.error("Failed to initialize Plyr:", error);
          this.ui.showError(
            `Failed to initialize video player: ${error.message}`
          );
          throw error;
        }

        // === custom quality indicator to Plyr controls ===
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
          const controlsBar = this.ui._getCachedElement(".plyr__controls");
          if (
            controlsBar &&
            !document.getElementById("plyr-quality-indicator")
          ) {
            const qualityIndicator = document.createElement("span");
            qualityIndicator.id = "plyr-quality-indicator";
            qualityIndicator.className = "plyr__quality-indicator";
            qualityIndicator.textContent = "...";
            // Use CSS string for better performance
            qualityIndicator.style.cssText = `
              margin: 0 0px;
              color: #fff;
              font-weight: bold;
              background: none;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 13px;
              pointer-events: none;
            `;

            // Use utility function to add before fullscreen
            addToPlyrControlsBar(qualityIndicator, {
              before: '[data-plyr="fullscreen"]',
            });
          }
        }, 0);

        // Setup context menu after Plyr is initialized
        setTimeout(() => {
          this.ui.setupVideoContextMenu();
        }, 100);
      }

      this.ui.elements.video.classList.remove("hidden-until-plyr");

      // Fetch available subtitle tracks and create selector
      await this.subtitlesManager.fetchAvailableTracks();

      // Initialize subtitles if available
      if (subtitleContent) {
        // Only initialize default if user hasn't manually selected a track
        if (this.subtitlesManager.userSelectedTrack === null) {
          await this.subtitlesManager.initialize(subtitleContent, subtitlesUrl);
          this.subtitlesLoaded = true;
          if (
            this.subtitlesManager.currentTrack === undefined ||
            this.subtitlesManager.currentTrack === null
          ) {
            this.subtitlesManager.currentTrack = 0;
          }
          this.ui.showStep("SubtitlesOctopus initialized");
        }
      } else {
        this.subtitlesLoaded = false;
        this.subtitlesManager.currentTrack = null;
        this.ui.showStep(
          "Subtitles not ready yet, will try again when video is ready"
        );
      }

      // Create selector after determining subtitle state
      this.subtitlesManager.createSubtitleSelector();

      // Initialize audio manager for multi-track audio support
      try {
        await this.audioManager.initialize();
        if (CONFIG.DEBUG_MODE) {
          console.log("Audio manager initialized successfully");
        }

        // Create audio selector UI only if initialization was successful
        if (this.audioManager.initialized) {
          this.audioManager.createAudioSelector();
          if (CONFIG.DEBUG_MODE) {
            console.log("Audio selector UI created successfully");
          }
        }
      } catch (error) {
        if (CONFIG.DEBUG_MODE) {
          console.warn("Failed to initialize audio manager:", error);
        }
      }

      this.ui.setStatusMessage("");
    } catch (error) {
      console.error("Failed to load video or subtitles:", error);
      this.ui.showError(`Failed to load video or subtitles: ${error.message}`);
      return false;
    }
  }

  // Handle status updates from the poller
  handleStatusUpdate(data, errorMsg) {
    try {
      if (data) {
        // Check if file was deleted externally
        if (data.fileDeleted) {
          if (CONFIG.DEBUG_MODE)
            console.log(
              "File was deleted externally, cleaning up localStorage"
            );
          this.clearLocalStorageData();
          this.ui.showError(
            "Video file was deleted. Please reload with a new torrent."
          );
          this.statusPoller.stop();
          return;
        }

        // Check if download is starting from zero (fresh download)
        if (
          data.status === "downloading" &&
          data.progress === 0 &&
          data.downloaded === 0 &&
          !this.hasSeenDownloadProgress
        ) {
          this.clearLocalStorageData();
          this.hasSeenDownloadProgress = true;
        } else if (data.downloaded > 0) {
          // Mark that we've seen some progress
          this.hasSeenDownloadProgress = true;
        }

        this.ui.updateStatusBar(data);

        // Start player when downloading begins - with error handling
        if (
          (data.status === "downloading" || data.status === "done") &&
          !this.playerStarted
        ) {
          this.playerStarted = true;
          this.startPlayer().catch((error) => {
            console.error("Error starting player:", error);
            this.ui.showError(`Failed to start player: ${error.message}`);
          });
        }

        // Set ready flag for fast start
        if (data.downloaded && data.downloaded > CONFIG.READY_THRESHOLD) {
          try {
            localStorage.setItem(this.playerReadyKey, "1");
            this.ui.hideLoading();
          } catch (storageError) {
            console.warn(
              "Failed to set localStorage ready flag:",
              storageError
            );
            this.ui.hideLoading(); // Still hide loading even if storage fails
          }
        }

        this.ui.setStatusMessage("");
      } else {
        this.ui.updateStatusBar();
        this.ui.setStatusMessage(errorMsg || "");
      }
    } catch (error) {
      console.error("Error in handleStatusUpdate:", error);
      if (CONFIG.DEBUG_MODE) {
        console.error("Stack trace:", error.stack);
        console.error("Data:", data);
        console.error("Error message:", errorMsg);
      }
      // Prevent cascading errors
      this.ui.showError(
        "An error occurred during status update. Please refresh."
      );
    }
  }

  // Handle video error event and trigger retry logic
  handleVideoError() {
    if (CONFIG.DEBUG_MODE) console.log("Video error event triggered");

    // Check if error is due to resource exhaustion
    if (ChromeResourceManager.monitorMemory()) {
      console.warn("Video error may be due to high memory usage");
      ChromeResourceManager.forceGarbageCollection();
    }

    this.ui.showError("Video loading... (will retry automatically)");
    this.ui.showRetryButton();
    this.ui.showStep("Video error event - starting retry");

    this.retryController.executeRetry(
      () => this.ui.elements.video.load(),
      (message) => this.ui.showStep(message)
    );
  }

  // Handle video canplay event (ready to play)
  handleVideoCanPlay() {
    this.ui.hideLoading();
    this.ui.hidePlyrLoadingOverlay();
    this.ui.showVideoContainer();
    this.ui.hideError();
    this.ui.hideRetryButton();
    this.ui.hideStep();

    this.retryController.reset();

    // Try to load subtitles if not loaded yet
    if (!this.subtitlesLoaded) {
      // Fetch available tracks first, then load the first one
      this.subtitlesManager.fetchAvailableTracks().then(() => {
        const subtitlesUrl = `/subtitles?url=${encodeURIComponent(
          this.magnetUrl
        )}&track=0`;
        // Add timestamp to bypass cache
        const urlWithTimestamp = subtitlesUrl + "&_t=" + Date.now();
        this.resourceLoader
          .pollUntilReady(urlWithTimestamp, true)
          .then((subtitleContent) => {
            if (subtitleContent) {
              this.subtitlesManager.initialize(subtitleContent, subtitlesUrl);
              this.subtitlesLoaded = true;
              // Only set currentTrack to 0 if it is undefined or null (initial load)
              if (
                this.subtitlesManager.currentTrack === undefined ||
                this.subtitlesManager.currentTrack === null
              ) {
                this.subtitlesManager.currentTrack = 0;
              }
              this.ui.showStep("Subtitles loaded after video ready");
            } else {
              // No subtitles available
              this.subtitlesManager.currentTrack = null;
            }
            // Create/update selector after determining subtitle state
            this.subtitlesManager.createSubtitleSelector();
          })
          .catch(() => {
            // Ignore if still not ready, but update selector
            this.subtitlesManager.currentTrack = null;
            this.subtitlesManager.createSubtitleSelector();
          });
      });
    }
  }

  // Handle video loadstart event
  handleVideoLoadStart() {
    this.ui.updatePlyrLoadingText("Loading video...");
  }

  // Handle video loadedmetadata event
  handleVideoLoadedMetadata() {
    try {
      const video = this.ui.elements.video;

      // Store original duration on first successful load
      if (
        !this.originalDuration &&
        isFinite(video.duration) &&
        video.duration > 0
      ) {
        this.originalDuration = video.duration;
        if (CONFIG.DEBUG_MODE)
          console.log(
            "[AUDIO] Stored original duration:",
            this.originalDuration
          );
      }

      // Fallback: if duration is null, NaN, or Infinity after loadedmetadata, use originalDuration after short timeout
      setTimeout(() => {
        try {
          if (!isFinite(video.duration) || video.duration == null) {
            try {
              const fallbackDuration =
                this.originalDuration || this.previousDuration;
              if (isFinite(fallbackDuration)) {
                Object.defineProperty(video, "duration", {
                  value: fallbackDuration,
                });
                video.dispatchEvent(new Event("durationchange"));
                if (
                  this.plyrInstance &&
                  typeof this.plyrInstance.update === "function"
                ) {
                  this.plyrInstance.update();
                }
                if (CONFIG.DEBUG_MODE)
                  console.log(
                    "[AUDIO] Fallback: set duration to:",
                    fallbackDuration,
                    "(original:",
                    this.originalDuration,
                    "previous:",
                    this.previousDuration,
                    ")"
                  );
              }
            } catch (e) {
              if (CONFIG.DEBUG_MODE)
                console.warn("Failed to set fallback duration for Plyr:", e);
            }
          }
        } catch (durationError) {
          console.warn("Error handling duration fallback:", durationError);
        }
      }, 500);
    } catch (error) {
      console.error("Error in handleVideoLoadedMetadata:", error);
      if (CONFIG.DEBUG_MODE) {
        console.error("Metadata error stack:", error.stack);
      }
    }
    this.ui.updatePlyrLoadingText("Loading video data...");

    // Restore playback position on loadedmetadata
    const resumeTime = parseFloat(localStorage.getItem(this.resumeTimeKey));

    if (
      !this._suppressResumePrompt &&
      !isNaN(resumeTime) &&
      resumeTime > 0 &&
      resumeTime < this.ui.elements.video.duration
    ) {
      this.ui.showResumeButton();
      this._pendingResumeTime = resumeTime;
    } else {
      this.ui.hideResumeButton();
      this._pendingResumeTime = null;
    }

    // load video quality
    const height = this.ui.elements.video.videoHeight;
    const indicator = document.getElementById("plyr-quality-indicator");
    if (indicator && height) {
      indicator.textContent = `${height}p`;
    }
    // Update duration display for streaming/infinite videos
    const duration = this.ui.elements.video.duration;
    const durationDisplay = document.querySelector(
      ".plyr__time--duration, .plyr__duration"
    );
    let durationToShow = duration;
    if (!isFinite(durationToShow) || isNaN(durationToShow)) {
      const fallbackDuration = this.originalDuration || this.previousDuration;
      if (fallbackDuration && isFinite(fallbackDuration)) {
        durationToShow = fallbackDuration;
      }
    }
    if (durationDisplay) {
      if (!isFinite(durationToShow) || isNaN(durationToShow)) {
        durationDisplay.textContent = "Live";
      } else {
        // Format duration as mm:ss or hh:mm:ss, always positive
        let dur = Math.floor(Math.abs(durationToShow));
        let h = Math.floor(dur / 3600);
        let m = Math.floor((dur % 3600) / 60);
        let s = dur % 60;
        let formatted =
          h > 0
            ? `${h}:${m.toString().padStart(2, "0")}:${s
                .toString()
                .padStart(2, "0")}`
            : `${m}:${s.toString().padStart(2, "0")}`;
        durationDisplay.textContent = formatted;
      }
    }
  }

  // Handle video loadeddata event
  handleVideoLoadedData() {
    this.ui.updatePlyrLoadingText("Preparing video...");
  }

  // Handle video canplaythrough event
  handleVideoCanPlayThrough() {
    this.ui.hidePlyrLoadingOverlay();
  }

  // Handle manual retry button click
  handleManualRetry() {
    this.ui.hideRetryButton();
    this.ui.hideError();
    this.retryController.reset();
    this.ui.showStep("Manual retry triggered");
    this.ui.elements.video.load();
  }

  // Handle resume button click
  handleResumeClick() {
    this.ui.hideResumeButton(); // Hide immediately, always
    if (
      this._pendingResumeTime &&
      this.ui.elements.video.duration > this._pendingResumeTime
    ) {
      this.ui.elements.video.currentTime = this._pendingResumeTime;

      // Start playback if paused
      if (this.ui.elements.video.paused) {
        this.ui.elements.video.play(); // starts playing video
      }
    }
  }

  // Handle restart button click
  handleRestartClick() {
    this.ui.elements.video.currentTime = 0;
    this.ui.hideResumeButton();
    localStorage.removeItem(this.resumeTimeKey);
    // Always play from beginning
    if (this.ui.elements.video.paused) {
      this.ui.elements.video.play(); // starts playing video
    }
  }

  // Handle initialization errors
  handleInitializationError(error) {
    this.ui.hideLoading();
    this.ui.showError(error.message);
    this.ui.showStep(`Player error: ${error.message}`);
    this.statusPoller.stop();
  }

  // Cleanup resources and notify server when leaving page
  cleanup() {
    // Clear memory monitoring interval
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }

    if (!CONFIG.MANUAL_CLEANUP) {
      if (CONFIG.DEBUG_MODE)
        console.log("Manual cleanup is disabled - skipping immediate cleanup");
      this.statusPoller.stop();
      this.retryController.clearContinuousRetry();
      this.subtitlesManager.cleanup();
      return;
    }

    if (CONFIG.DEBUG_MODE)
      console.log(
        "Manual cleanup enabled - sending goodbye beacon for:",
        this.magnetUrl
      );
    this.statusPoller.stop();
    this.retryController.clearContinuousRetry();
    this.subtitlesManager.cleanup();
    this.audioManager.cleanup();

    // Cleanup UI controller for better memory management
    this.ui.cleanup();

    // Send goodbye beacon to server to clean up torrent/files
    // Use URL parameter instead of FormData for better compatibility
    const encodedUrl = encodeURIComponent(this.magnetUrl);
    const goodbyeUrl = `/goodbye?url=${encodedUrl}`;

    // Try multiple approaches to ensure cleanup happens
    try {
      // Method 1: sendBeacon with URL parameter (preferred)
      const sent = navigator.sendBeacon(goodbyeUrl);
      if (CONFIG.DEBUG_MODE) console.log("SendBeacon result:", sent);

      // Method 2: Fallback fetch with URL parameter and handle response
      if (!sent) {
        fetch(goodbyeUrl, {
          method: "POST",
          keepalive: true,
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.shouldClearLocalStorage && data.magnet) {
              this.clearLocalStorageData();
            }
          })
          .catch((err) => console.log("Fetch cleanup failed:", err));
      }
    } catch (err) {
      if (CONFIG.DEBUG_MODE) console.error("Cleanup beacon failed:", err);
      // Method 3: Last resort - synchronous XHR with URL parameter
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", goodbyeUrl, false); // synchronous
        xhr.send();
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.shouldClearLocalStorage && response.magnet) {
              if (CONFIG.DEBUG_MODE)
                console.log(
                  "Server requested localStorage cleanup for:",
                  response.magnet
                );
              this.clearLocalStorageData();
            }
          } catch (parseErr) {
            if (CONFIG.DEBUG_MODE)
              console.log("Could not parse cleanup response");
          }
        }
      } catch (xhrErr) {
        if (CONFIG.DEBUG_MODE) console.error("XHR cleanup failed:", xhrErr);
      }
    }

    // Clear localStorage data AFTER server cleanup
    setTimeout(() => {
      this.clearLocalStorageData();
    }, 100);
  }

  // Clear localStorage data related to this torrent
  clearLocalStorageData() {
    try {
      const removedKeys = [];

      if (CONFIG.DEBUG_MODE) {
        console.log("=== CLEARING LOCALSTORAGE ===");
        console.log("Magnet URL:", this.magnetUrl);
        console.log("Player Ready Key:", this.playerReadyKey);
        console.log("Resume Time Key:", this.resumeTimeKey);
      }
      if (localStorage.getItem(this.playerReadyKey)) {
        localStorage.removeItem(this.playerReadyKey);
        removedKeys.push(this.playerReadyKey);
        if (CONFIG.DEBUG_MODE)
          console.log("Removed playerReady key:", this.playerReadyKey);
      }

      if (localStorage.getItem(this.resumeTimeKey)) {
        localStorage.removeItem(this.resumeTimeKey);
        removedKeys.push(this.resumeTimeKey);
        if (CONFIG.DEBUG_MODE)
          console.log("Removed resumeTime key:", this.resumeTimeKey);
      }

      // Look for keys that contain this exact magnet URL or its hash
      const magnetHash = this.magnetUrl.split("btih:")[1]?.split("&")[0];
      const keysToRemove = [];

      if (CONFIG.DEBUG_MODE)
        console.log("Scanning localStorage for magnet-related keys...");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (CONFIG.DEBUG_MODE) console.log(`Checking key: ${key}`);
          if (
            key.includes(this.magnetUrl) ||
            (magnetHash && key.includes(magnetHash)) ||
            key === this.playerReadyKey ||
            key === this.resumeTimeKey
          ) {
            keysToRemove.push(key);
            if (CONFIG.DEBUG_MODE)
              console.log(`Key marked for removal: ${key}`);
          }
        }
      }

      keysToRemove.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          removedKeys.push(key);
          if (CONFIG.DEBUG_MODE) console.log(`Removed key: ${key}`);
        }
      });

      if (CONFIG.DEBUG_MODE)
        console.log(`Total removed keys: ${removedKeys.length}`);
      if (CONFIG.DEBUG_MODE) console.log("Removed keys:", removedKeys);
      if (CONFIG.DEBUG_MODE) console.log("=== CLEANUP COMPLETE ===");
    } catch (err) {
      if (CONFIG.DEBUG_MODE)
        console.error("Failed to clear localStorage:", err);
    }
  }
}

/**
 * Fullscreen Controller - Handles fullscreen mode overlay management
 */
class FullscreenController {
  constructor() {
    this.watermark = document.querySelector(".video-watermark");
    this.resumeModule = document.getElementById("resume-module");
    this.subtitleSelector = document.getElementById(
      "subtitle-selector-container"
    );
    this.bindEvents();
  }

  // Bind fullscreen change events
  bindEvents() {
    document.addEventListener("fullscreenchange", () => {
      this.handleFullscreenOverlay();
    });
  }

  // Handle fullscreen overlay positioning
  handleFullscreenOverlay() {
    const fsElement = document.fullscreenElement;

    // Dynamically get current elements (they may be created after constructor)
    this.subtitleSelector = document.getElementById(
      "subtitle-selector-container"
    );

    // Track if elements were open before fullscreen
    const selectorWasOpen =
      this.subtitleSelector && this.subtitleSelector.style.display !== "none";

    if (fsElement) {
      this.enterFullscreen(fsElement, selectorWasOpen);
    } else {
      this.exitFullscreen(selectorWasOpen);
    }
  }

  // Configure elements for fullscreen mode
  enterFullscreen(fsElement, selectorWasOpen) {
    if (this.watermark) {
      fsElement.appendChild(this.watermark);
      this.watermark.style.position = "absolute";
      this.watermark.style.top = "20px";
      this.watermark.style.right = "30px";
      this.watermark.style.zIndex = "2147483647";
    }

    if (this.resumeModule) {
      fsElement.appendChild(this.resumeModule);
      this.resumeModule.style.position = "absolute";
      this.resumeModule.style.top = "0";
      this.resumeModule.style.left = "0";
      this.resumeModule.style.width = "100%";
      this.resumeModule.style.height = "100%";
      this.resumeModule.style.zIndex = "10000";
    }

    if (this.subtitleSelector) {
      // Always append selector to fullscreen element
      if (!fsElement.contains(this.subtitleSelector)) {
        fsElement.appendChild(this.subtitleSelector);
      }
      this.subtitleSelector.style.zIndex = "2147483647";
      // Restore display state if it was open before fullscreen
      if (selectorWasOpen) {
        this.subtitleSelector.style.display = "";
        // Also force controls bar visible if selector is open
        const controlsBar = document.querySelector(".plyr__controls");
        if (controlsBar) controlsBar.classList.add("plyr-controls-forced");
      }
    }
  }

  // Restore elements to normal container when exiting fullscreen
  exitFullscreen(selectorWasOpen) {
    const container = document.querySelector(".video-container-tag");

    if (container && this.watermark && !container.contains(this.watermark)) {
      container.appendChild(this.watermark);
    }

    if (
      container &&
      this.resumeModule &&
      !container.contains(this.resumeModule)
    ) {
      container.appendChild(this.resumeModule);
    }

    if (
      container &&
      this.subtitleSelector &&
      !container.contains(this.subtitleSelector)
    ) {
      container.appendChild(this.subtitleSelector);
      this.subtitleSelector.style.zIndex = "9999";
      // Restore display state if it was open before exiting fullscreen
      if (selectorWasOpen) {
        this.subtitleSelector.style.display = "";
        // Also force controls bar visible if selector is open
        const controlsBar = document.querySelector(".plyr__controls");
        if (controlsBar) controlsBar.classList.add("plyr-controls-forced");
      } else {
        this.subtitleSelector.style.display = "none";
        const controlsBar = document.querySelector(".plyr__controls");
        if (controlsBar) controlsBar.classList.remove("plyr-controls-forced");
      }
    }
  }
}

/**
 * Utility function to clean localStorage for any magnet URL
 * Can be called from browser console: cleanLocalStorageForMagnet('magnet:?xt=...')
 */
window.cleanLocalStorageForMagnet = function (magnetUrl) {
  if (!magnetUrl) {
    if (CONFIG.DEBUG_MODE) console.error("Please provide a magnet URL");
    return;
  }

  try {
    if (CONFIG.DEBUG_MODE) console.log("=== GLOBAL CLEANUP FUNCTION ===");
    if (CONFIG.DEBUG_MODE) console.log("Target magnet:", magnetUrl);

    const removedKeys = [];
    const magnetHash = magnetUrl.split("btih:")[1]?.split("&")[0];
    const keysToRemove = [];

    if (CONFIG.DEBUG_MODE) console.log("Extracted hash:", magnetHash);
    if (CONFIG.DEBUG_MODE)
      console.log("Current localStorage size:", localStorage.length);

    // Find all keys related to this magnet
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (CONFIG.DEBUG_MODE) console.log(`Checking key: ${key}`);
        if (
          key.includes(magnetUrl) ||
          (magnetHash && key.includes(magnetHash))
        ) {
          keysToRemove.push(key);
          if (CONFIG.DEBUG_MODE) console.log(`Key marked for removal: ${key}`);
        }
      }
    }

    if (CONFIG.DEBUG_MODE)
      console.log(`Found ${keysToRemove.length} keys to remove`);

    // Remove all found keys
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      removedKeys.push(key);
      if (CONFIG.DEBUG_MODE) console.log(`Removed key: ${key}`);
    });

    if (CONFIG.DEBUG_MODE)
      console.log(
        `Cleaned ${removedKeys.length} localStorage keys for magnet:`,
        magnetUrl
      );
    if (CONFIG.DEBUG_MODE) console.log("Removed keys:", removedKeys);
    if (CONFIG.DEBUG_MODE) console.log("=== GLOBAL CLEANUP COMPLETE ===");
    return { success: true, removedKeys };
  } catch (err) {
    if (CONFIG.DEBUG_MODE) console.error("Failed to clean localStorage:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Global cleanup notification system
 * Allows server or other sources to trigger localStorage cleanup for all users
 */
window.notifyMagnetDeleted = function (magnetUrl) {
  if (!magnetUrl) {
    if (CONFIG.DEBUG_MODE) console.error("Please provide a magnet URL");
    return;
  }

  if (CONFIG.DEBUG_MODE)
    console.log("Received notification that magnet was deleted:", magnetUrl);

  // Clean localStorage for this magnet
  const result = window.cleanLocalStorageForMagnet(magnetUrl);

  // If we have an active player for this magnet, show error and stop
  if (window.player && window.player.magnetUrl === magnetUrl) {
    window.player.ui.showError(
      "Files were deleted. Please reload with a new torrent."
    );
    window.player.statusPoller.stop();
  }

  return result;
};

document.addEventListener("mousedown", function handleOutsideClick(event) {
  const selector = document.getElementById("subtitle-selector-container");
  const ccBtn = document.getElementById("plyr-subtitles-btn");
  if (
    selector &&
    selector.style.display !== "none" &&
    !selector.contains(event.target) &&
    (!ccBtn || !ccBtn.contains(event.target))
  ) {
    selector.style.display = "none";
    // Restore CC button if you hide it when selector is open
    if (ccBtn) ccBtn.style.display = "";
    // Remove forced controls class
    const controlsBar = document.querySelector(".plyr__controls");
    if (controlsBar) controlsBar.classList.remove("plyr-controls-forced");
  }
});

/**
 * Utility function to add elements to the Plyr controls bar
 * @param {HTMLElement} element - The element to add
 * @param {Object} options - Positioning options
 * @param {string|HTMLElement} options.before - Element or selector to insert before
 * @param {string|HTMLElement} options.after - Element or selector to insert after
 * @param {boolean} options.prepend - Insert at the beginning
 * @param {boolean} options.append - Insert at the end (default)
 */
function addToPlyrControlsBar(element, options = {}) {
  const controlsBar = document.querySelector(".plyr__controls");
  if (!controlsBar) {
    if (CONFIG.DEBUG_MODE) console.warn("Plyr controls bar not found");
    return false;
  }

  // Handle 'before' option
  if (options.before) {
    const ref =
      typeof options.before === "string"
        ? controlsBar.querySelector(options.before)
        : options.before;
    if (ref) {
      controlsBar.insertBefore(element, ref);
      return true;
    }
  }

  // Handle 'after' option
  if (options.after) {
    const ref =
      typeof options.after === "string"
        ? controlsBar.querySelector(options.after)
        : options.after;
    if (ref && ref.nextSibling) {
      controlsBar.insertBefore(element, ref.nextSibling);
      return true;
    } else if (ref) {
      controlsBar.appendChild(element);
      return true;
    }
  }

  // Handle 'prepend' option
  if (options.prepend) {
    controlsBar.insertBefore(element, controlsBar.firstChild);
    return true;
  }

  // Default: append to end
  controlsBar.appendChild(element);
  return true;
}

/**
 * Audio Manager - Handles multi-track audio selection and switching
 */
class AudioManager {
  constructor(magnetUrl) {
    this.magnetUrl = magnetUrl;
    this.availableTracks = [];
    this.currentTrack = 0;
    this.audioSelector = null;
    this.initialized = false;
  }

  // Initialize audio manager and fetch available tracks
  async initialize() {
    try {
      await this.fetchAvailableTracks();
      // Only initialize if availableTracks is an array and has more than 1 track
      if (
        !Array.isArray(this.availableTracks) ||
        this.availableTracks.length <= 1
      ) {
        if (CONFIG.DEBUG_MODE) {
          console.warn(
            "Audio manager: No multi audio tracks found, skipping initialization."
          );
        }
        this.initialized = false;
        return;
      }
      this.initialized = true;
      if (CONFIG.DEBUG_MODE) {
        console.log(
          `Audio manager initialized with ${this.availableTracks.length} tracks`
        );
      }
    } catch (error) {
      if (CONFIG.DEBUG_MODE) {
        console.warn("Failed to initialize audio manager:", error);
      }
      this.initialized = false;
    }
  }

  // Fetch available audio tracks from backend
  async fetchAvailableTracks() {
    try {
      const response = await fetch(
        `/audio-tracks?url=${encodeURIComponent(this.magnetUrl)}`
      );
      const text = await response.text();

      if (text === "NOT_READY") {
        this.availableTracks = [];
        return;
      }

      const tracks = JSON.parse(text);
      this.availableTracks = tracks || [];

      if (CONFIG.DEBUG_MODE) {
        console.log("Available audio tracks:", this.availableTracks);
      }
    } catch (error) {
      if (CONFIG.DEBUG_MODE) {
        console.warn("Failed to fetch audio tracks:", error);
      }
      this.availableTracks = [];
    }
  }

  // Create audio track selector UI
  createAudioSelector() {
    this.removeAudioSelector();

    if (
      !Array.isArray(this.availableTracks) ||
      this.availableTracks.length <= 1
    ) {
      return; // No need for selector with 0 or 1 track
    }

    // Create Plyr-style audio switch button
    const switchButton = document.createElement("button");
    switchButton.id = "audio-switch-btn";
    switchButton.className =
      "plyr__controls__item plyr__control plyr__audio-switch";
    switchButton.type = "button";
    switchButton.setAttribute("aria-label", "Audio tracks");
    switchButton.setAttribute("data-plyr", "audio-switch");

    // Microphone SVG icon
    const svgNS = "http://www.w3.org/2000/svg";
    const micIcon = document.createElementNS(svgNS, "svg");
    micIcon.setAttribute("width", "18");
    micIcon.setAttribute("height", "18");
    micIcon.setAttribute("viewBox", "0 0 24 24");
    const micPath = document.createElementNS(svgNS, "path");
    micPath.setAttribute(
      "d",
      "M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-2.07c3.39-.5 6-3.4 6-6.93h-2z"
    );
    micPath.setAttribute("fill", "currentColor");
    micIcon.appendChild(micPath);
    switchButton.appendChild(micIcon);

    // Audio selector container styled like subtitles
    const selectorContainer = document.createElement("div");
    selectorContainer.id = "audio-selector-container";
    selectorContainer.className = "plyr__menu";
    selectorContainer.setAttribute("data-plyr", "audio-menu");
    selectorContainer.style.cssText = `
    position: absolute;
    bottom: 100%;
    right: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.9);
    border-radius: 8px;
    min-width: 160px;
    max-height: 200px;
    overflow-y: auto;
    display: none;
    font-family: inherit;
    font-size: 14px;
    color: #fff;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    padding: 8px 0;
  `;

    // Add track options (no "None" option)
    this.availableTracks.forEach((track, index) => {
      const option = document.createElement("div");
      option.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

      const trackSpan = document.createElement("span");
      trackSpan.textContent = `${track.language} - ${track.title}`;

      const checkMarkSpan = document.createElement("span");
      checkMarkSpan.textContent = "✓";
      checkMarkSpan.style.marginLeft = "8px";
      checkMarkSpan.style.opacity = this.currentTrack === index ? "1" : "0";
      checkMarkSpan.style.color = "#fff";

      option.appendChild(trackSpan);
      option.appendChild(checkMarkSpan);
      option.dataset.value = index;

      if (this.currentTrack === index) {
        option.style.backgroundColor = "rgba(255,255,255,0.1)";
        option.style.fontWeight = "bold";
      }

      option.addEventListener("mouseenter", () => {
        option.style.backgroundColor = "rgba(255,255,255,0.1)";
      });
      option.addEventListener("mouseleave", () => {
        if (this.currentTrack === index) {
          option.style.backgroundColor = "rgba(255,255,255,0.1)";
        } else {
          option.style.backgroundColor = "transparent";
        }
      });
      option.addEventListener("click", () => {
        this.switchToTrack(index);
        selectorContainer.style.display = "none";
      });

      selectorContainer.appendChild(option);
    });

    // Toggle selector visibility
    switchButton.addEventListener("click", () => {
      const isVisible = selectorContainer.style.display === "block";
      selectorContainer.style.display = isVisible ? "none" : "block";
    });

    // Close selector when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !switchButton.contains(e.target) &&
        !selectorContainer.contains(e.target)
      ) {
        selectorContainer.style.display = "none";
      }
    });

    // Add to Plyr controls bar using utility function
    const added = addToPlyrControlsBar(switchButton, {
      before: '[data-plyr="fullscreen"]',
    });

    if (added) {
      switchButton.style.position = "relative";
      switchButton.appendChild(selectorContainer);
      this.audioSelector = selectorContainer;
    } else {
      const videoContainer = document.getElementById("video-container");
      if (videoContainer) {
        videoContainer.appendChild(switchButton);
        videoContainer.appendChild(selectorContainer);
        this.audioSelector = selectorContainer;
      }
    }
  }

  // Switch to a different audio track
  async switchToTrack(trackIndex) {
    if (trackIndex === this.currentTrack) {
      return; // Already on this track
    }
    if (
      window.player &&
      typeof window.player.suppressResumePromptForNextLoad === "function"
    ) {
      window.player.suppressResumePromptForNextLoad();
    }
    try {
      const video = document.getElementById("player");
      if (!video) {
        console.error("Video element not found");
        return;
      }

      // Store current time
      const currentTime = video.currentTime;
      const wasPlaying = !video.paused;
      const oldSrc = video.src;

      if (CONFIG.DEBUG_MODE) {
        console.log(
          `[AUDIO] Switching from track ${this.currentTrack} to track ${trackIndex}`
        );
        console.log(
          `[AUDIO] Current time: ${currentTime}, was playing: ${wasPlaying}`
        );
        console.log(`[AUDIO] Old source: ${oldSrc}`);
      }

      // Update video source to use new audio track
      const newSrc = `/video?url=${encodeURIComponent(
        this.magnetUrl
      )}&audioTrack=${trackIndex}`;

      if (CONFIG.DEBUG_MODE) {
        console.log(`[AUDIO] New source: ${newSrc}`);
      }

      // Test if the new source is actually different and valid
      if (oldSrc === newSrc) {
        console.warn(
          `[AUDIO] Source URL is the same, audio track might not be changing`
        );
      }

      // Show loading indicator but don't hide video
      const loadingOverlay = document.getElementById("plyr-loading-overlay");
      const loadingText = loadingOverlay?.querySelector(".plyr-loading-text");
      if (loadingOverlay) {
        loadingOverlay.style.display = "flex";
        loadingOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; // Semi-transparent
        if (loadingText) {
          loadingText.textContent = `Switching to audio track ${
            trackIndex + 1
          }...`;
        }
      }

      // Don't pause the video immediately - let it play until new source is ready
      // video.pause(); // Commented out to avoid interruption

      // Add error handler before changing source
      const handleVideoError = (e) => {
        console.error(`[AUDIO] Video error during track switch:`, e);
        console.error(`[AUDIO] Video error code:`, video.error?.code);
        console.error(`[AUDIO] Video error message:`, video.error?.message);

        // Try to fallback to original source
        if (oldSrc && oldSrc !== newSrc) {
          console.log(`[AUDIO] Falling back to original source`);
          video.src = oldSrc;
          video.load();
        }

        if (loadingOverlay) {
          loadingOverlay.style.display = "none";
        }
      };

      video.addEventListener("error", handleVideoError, { once: true });

      // Pre-load the new source and only switch when ready
      const testVideo = document.createElement("video");
      testVideo.preload = "metadata";
      testVideo.muted = true; // Prevent audio interference

      const switchWhenReady = () => {
        console.log(`[AUDIO] New source is ready, switching now`);

        // Now pause current video and switch
        video.pause();
        video.src = newSrc;
        video.load();

        // Clean up test video
        testVideo.remove();
      };

      const testError = (e) => {
        console.error(`[AUDIO] New source failed to load:`, e);
        if (loadingOverlay) {
          loadingOverlay.style.display = "none";
        }
        testVideo.remove();
      };

      testVideo.addEventListener("loadedmetadata", switchWhenReady, {
        once: true,
      });
      testVideo.addEventListener("error", testError, { once: true });
      testVideo.src = newSrc;

      video.pause();
      video.src = newSrc;
      video.load();

      // Wait for video to be ready and restore position
      const restorePlayback = () => {
        console.log(`[AUDIO] Restoring playback at ${currentTime}`);

        // Force metadata refresh for new audio track
        video.currentTime = currentTime;

        // Trigger metadata refresh events
        const refreshMetadata = () => {
          console.log(`[AUDIO] Refreshing metadata for new audio track`);

          // Update audio track info in UI if available
          if (this.availableTracks && this.availableTracks[trackIndex]) {
            const trackInfo = this.availableTracks[trackIndex];
            console.log(`[AUDIO] New track metadata:`, trackInfo);

            // Update context menu or any UI showing current audio track
            if (typeof this.updateAudioTrackMetadata === "function") {
              this.updateAudioTrackMetadata(trackIndex, trackInfo);
            } else {
              console.warn(
                "[AUDIO] updateAudioTrackMetadata method not available, skipping metadata UI update"
              );
            }
          }

          // Force Plyr to refresh its internal state
          if (this.plyrInstance) {
            // Trigger Plyr to re-read video metadata
            this.plyrInstance.media.load();

            // Update quality indicator if needed
            const height = video.videoHeight;
            const indicator = document.getElementById("plyr-quality-indicator");
            if (indicator && height) {
              indicator.textContent = `${height}p`;
            }
          }

          // Dispatch custom event for any listeners
          video.dispatchEvent(
            new CustomEvent("audioTrackChanged", {
              detail: {
                trackIndex: trackIndex,
                trackInfo: this.availableTracks?.[trackIndex],
              },
            })
          );
        };

        // Wait for metadata to be loaded before refreshing
        if (video.readyState >= 1) {
          // HAVE_METADATA
          refreshMetadata();
        } else {
          video.addEventListener("loadedmetadata", refreshMetadata, {
            once: true,
          });
        }

        if (wasPlaying) {
          video.play().catch((e) => {
            console.warn("[AUDIO] Play failed after track switch:", e);
          });
        }

        if (loadingOverlay) {
          loadingOverlay.style.display = "none";
          loadingOverlay.style.backgroundColor = ""; // Reset background
          const loadingText =
            loadingOverlay.querySelector(".plyr-loading-text");
          if (loadingText) {
            loadingText.textContent = "Loading video player..."; // Reset text
          }
        }

        // Verify the switch actually worked
        setTimeout(() => {
          console.log(
            `[AUDIO] Final verification - Current source: ${video.src}`
          );
          console.log(`[AUDIO] Expected source: ${newSrc}`);
          console.log(`[AUDIO] Sources match: ${video.src === newSrc}`);
          console.log(`[AUDIO] Audio track switch completed successfully`);

          // Final metadata check
          console.log(`[AUDIO] Video duration: ${video.duration}`);
          console.log(`[AUDIO] Video ready state: ${video.readyState}`);
        }, 1000);
      };

      video.addEventListener("canplay", restorePlayback, { once: true });

      // Fallback timeout - reduce from 10s to 5s since remuxing is faster
      setTimeout(() => {
        if (loadingOverlay && loadingOverlay.style.display !== "none") {
          console.warn(
            `[AUDIO] Timeout waiting for canplay event, forcing restore`
          );
          restorePlayback();
        }
      }, 5000); // Reduced timeout since lossless remuxing is much faster

      this.currentTrack = trackIndex;
      this.updateSelectorDisplay();

      if (CONFIG.DEBUG_MODE) {
        console.log(
          `[AUDIO] Track switch initiated to: ${
            this.availableTracks[trackIndex]?.title || trackIndex
          }`
        );
      }
    } catch (error) {
      console.error("[AUDIO] Failed to switch audio track:", error);
    }
  }
  suppressResumePromptForNextLoad() {
    this._suppressResumePrompt = true;
    setTimeout(() => {
      this._suppressResumePrompt = false;
    }, 2000); // Reset after 2 seconds
  }
  // Update selector display to reflect current track
  updateSelectorDisplay() {
    if (this.audioSelector) {
      const options = this.audioSelector.querySelectorAll("[data-value]");
      options.forEach((option, index) => {
        const checkmark = option.querySelector("span:last-child");
        const isSelected = index === this.currentTrack;

        if (isSelected) {
          option.style.backgroundColor = "rgba(33, 150, 243, 0.3)";
          if (checkmark) checkmark.style.opacity = "1";
        } else {
          option.style.backgroundColor = "transparent";
          if (checkmark) checkmark.style.opacity = "0";
        }
      });
    }
  }

  // Remove audio selector UI
  removeAudioSelector() {
    const existingBtn = document.getElementById("audio-switch-btn");
    const existingSelector = document.getElementById(
      "audio-selector-container"
    );
    if (existingBtn) existingBtn.remove();
    if (existingSelector) existingSelector.remove();
    this.audioSelector = null;
  }

  // Get current track info
  getCurrentTrackInfo() {
    if (this.availableTracks && this.availableTracks[this.currentTrack]) {
      return this.availableTracks[this.currentTrack];
    }
    return null;
  }

  // Check if audio manager is ready for use
  isReady() {
    return (
      this.initialized &&
      Array.isArray(this.availableTracks) &&
      this.availableTracks.length > 1
    );
  }

  // Get available track count
  getTrackCount() {
    return Array.isArray(this.availableTracks)
      ? this.availableTracks.length
      : 0;
  }

  // Clean up audio manager resources
  cleanup() {
    if (this.audioSelector) {
      this.removeAudioSelector();
    }
    this.availableTracks = [];
    this.currentTrack = 0;
    this.initialized = false;

    if (CONFIG.DEBUG_MODE) {
      console.log("Audio manager cleaned up");
    }
  }

  // Update audio track metadata in UI displays
  updateAudioTrackMetadata(trackIndex, trackInfo) {
    try {
      // Update context menu audio track display
      const audioTrackEl = document.getElementById("context-audio-track");

      if (
        audioTrackEl &&
        this.availableTracks &&
        this.availableTracks.length > 0
      ) {
        const currentTrack = this.availableTracks[trackIndex];
        const trackDisplayInfo = currentTrack
          ? `${currentTrack.language} - ${currentTrack.title}`
          : `Track ${trackIndex + 1}`;

        // Clear and rebuild content safely
        audioTrackEl.textContent = "";

        const activeSpan = document.createElement("span");
        activeSpan.style.color = "#4caf50";
        activeSpan.textContent = trackDisplayInfo;

        const countSpan = document.createElement("span");
        countSpan.style.color = "#81c784";
        countSpan.textContent = ` (${this.availableTracks.length} available)`;

        audioTrackEl.appendChild(activeSpan);
        audioTrackEl.appendChild(countSpan);

        if (CONFIG.DEBUG_MODE) {
          console.log(
            `[AUDIO] Updated audio track metadata: ${trackDisplayInfo}`
          );
        }
      }

      // Update page title to include current audio track
      const originalTitle = document.title.split(" - ")[0];
      if (trackInfo) {
        document.title = `${originalTitle} - ${
          trackInfo.language || "Audio"
        } Track`;
      }

      // Update any audio track indicators in the UI
      const audioIndicators = document.querySelectorAll(
        ".audio-track-indicator"
      );
      audioIndicators.forEach((indicator) => {
        if (trackInfo) {
          indicator.textContent = `${
            trackInfo.language || `Track ${trackIndex + 1}`
          }`;
        }
      });
    } catch (error) {
      if (CONFIG.DEBUG_MODE) {
        console.warn("[AUDIO] Failed to update metadata UI:", error);
      }
    }
  }
}

// ES6 module exports
export {
  VideoPlayerController,
  UIController,
  SubtitlesManager,
  AudioManager,
  RetryController,
  StatusPoller,
  ResourceLoader,
  FullscreenController,
};
