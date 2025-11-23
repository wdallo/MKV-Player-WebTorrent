/**
 * MKV Video Player Implementation
 * Class-based architecture
 */

// Magnet link validation utility
function isValidMagnet(url) {
  return (
    typeof url === "string" &&
    /^magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/.test(url)
  );
}

// Configuration constants for player behavior and timeouts
// Player configuration constants
const CONFIG = {
  MAX_RETRIES: 20, // Maximum number of retry attempts before switching to continuous retry
  BASE_RETRY_DELAY: 2000, // Initial delay (ms) before retrying video load
  MAX_RETRY_DELAY: 10000, // Maximum delay (ms) between retries
  CONTINUOUS_RETRY_INTERVAL: 30000, // Interval (ms) for continuous retry after max retries reached
  STATUS_POLL_INTERVAL: 1000, // Interval (ms) for polling torrent status from server
  READY_THRESHOLD: 256 * 1024, // Bytes downloaded before marking player as ready (256KB)
  RESOURCE_TIMEOUT: 300, // Number of polling attempts before timing out resource loading (approx 150 seconds)
  STALL_TIMEOUT: 20000, // Time (ms) to wait before considering torrent stalled (no peers)
  WATERMARK: false, // Show watermark on player if true
  WATERMARK_CONTENT: "Demo Watermark", // Text to display as watermark on video
  MANUAL_CLEANUP: false, // Enable immediate cleanup when player is closed/navigated away
  AUTO_DELETE_HOURS: 72, // Hours after which unused torrents are automatically deleted
  DEBUG_MODE: true, // Debug Mode on (true) / off (false)
};

// Make CONFIG available globally for UI access
window.CONFIG = CONFIG;

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
    // Cache references to important DOM elements
    this.elements = {
      progressBar: document.getElementById("progress-bar"),
      statusDetails: document.getElementById("status-details"),
      loading: document.getElementById("loading"),
      error: document.getElementById("error"),
      statusMsg: document.getElementById("status-msg"),
      retryBtn: document.getElementById("retry-btn"),
      videoContainer: document.getElementById("video-container"),
      plyrLoadingOverlay: document.getElementById("plyr-loading-overlay"),
      video: document.getElementById("player"),
      resumeBtn: document.getElementById("resume-btn"),
      restartBtn: document.getElementById("restart-btn"),
      resumeModule: document.getElementById("resume-module-inner"),
    };

    this.bindEvents();
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

  /**
   * Updates the download progress bar and status
   * @param {TorrentStatus} data - Torrent status data
   */
  updateStatusBar(data) {
    if (!data) {
      this.elements.progressBar.style.width = "0%";
      this.elements.statusDetails.innerHTML = "&nbsp;";
      // Show progress bar container if hidden
      if (this.elements.progressBar.parentElement)
        this.elements.progressBar.parentElement.style.display = "";
      return;
    }

    const percentage = (data.progress * 100).toFixed(1);
    const speedKB = (data.downloadSpeed / 1024).toFixed(1);
    const downloadedMB = (data.downloaded / (1024 * 1024)).toFixed(2);
    const totalMB = (data.length / (1024 * 1024)).toFixed(2);

    const message = this.formatStatusMessage(data, {
      percentage,
      speedKB,
      downloadedMB,
      totalMB,
    });

    this.elements.progressBar.style.width = `${percentage}%`;
    this.elements.statusDetails.innerHTML = message;

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
      message +=
        ' <span style="color:#ff5555">No seeds found or torrent stalled. Try another torrent.</span>';
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

  // Set main status message
  setStatusMessage(message) {
    this.elements.statusMsg.innerHTML = message;
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
    // Add a longer delay to ensure the context menu is properly positioned first
    setTimeout(() => {
      document.addEventListener("mousedown", hideMenu);
    }, 50);

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
        const contentSizeKB = (contentLength / 1024).toFixed(1);

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
    }, 1000);
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
      CONFIG.BASE_RETRY_DELAY + this.retryCount * 500,
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

    while (this.isActive) {
      try {
        const response = await fetch(
          `/status?url=${encodeURIComponent(this.magnetUrl)}`
        );

        if (response.ok) {
          const data = await response.json();
          this.updateNoPeersTracking(data);
          onStatusUpdate(data);
        } else {
          onStatusUpdate(null, "Waiting for torrent status...");
        }
      } catch (error) {
        onStatusUpdate(null, "Error fetching torrent status.");
      }

      await this.delay(CONFIG.STATUS_POLL_INTERVAL);
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
        if (response.status === 200 && text !== "NOT_READY") {
          // Resource is ready
          return isText ? text : url;
        } else if (response.status === 200 && text === "NOT_READY") {
          // Resource not ready yet, continue polling
        }
      } catch (error) {
        // Network error, continue polling
      }

      await this.delay(500);
    }

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
            "Failed to fetch subtitle tracks, status:",
            response.status
          );
      }
    } catch (error) {
      if (CONFIG.DEBUG_MODE)
        console.log("Failed to fetch subtitle tracks:", error);
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
      z-index: 9999;
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
      noneOption.innerHTML = `<span>None</span><span style="margin-left: 8px; opacity: 0.7;">✓</span>`;
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
        option.innerHTML = `<span>${track.language} - ${track.title}</span><span style="margin-left: 8px; opacity: 0.7;">✓</span>`;
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
  }

  // Remove subtitle selector UI
  removeSubtitleSelector() {
    const existing = document.getElementById("subtitle-selector-container");
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
      overlay.innerHTML = `<div style='width:64px;height:64px;border-radius:12px;background:none;display:flex;align-items:center;justify-content:center;'></div><div style='margin-top:24px;color:#fff;font-size:22px;'>Loading subtitles...</div>`;
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
      style.innerHTML = `.blurred-for-subtitles-loading {  filter: blur(6px) brightness(0.7); }`;
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
      this.octopus = new window.SubtitlesOctopus({
        video: this.videoElement,
        subContent: subtitleContent,
        workerUrl: "/libs/octopus/subtitles-octopus-worker.js",
        fonts: ["/libs/fonts/ARIALBD.TTF", "/libs/fonts/NotoSansJP-Bold.ttf"],
        fallbackFont: "/libs/fonts/ARIALBD.TTF",
        renderMode: "wasm-blend",
        targetFps: 24,
      });
      this.initialized = true;
      this.startPollingForUpdates();
    } else {
      throw new Error("SubtitlesOctopus not loaded!");
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
  constructor(magnetUrl) {
    // Validate magnet URL before proceeding
    if (!isValidMagnet(magnetUrl)) {
      throw new Error("Invalid or missing magnet URL provided");
    }

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

    // State
    this.playerInitialized = false;
    this.playerStarted = false;
    this.plyrInstance = null;
    this.subtitlesLoaded = false; // Track if subtitles are loaded
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

    // Initialize fullscreen controller
    this.fullscreenController = new FullscreenController();

    // Listen for localStorage changes from other tabs/windows
    this.setupCrossTabCleanup();
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

    // Video events
    this.ui.elements.video.addEventListener("error", () =>
      this.handleVideoError()
    );
    this.ui.elements.video.addEventListener("canplay", () =>
      this.handleVideoCanPlay()
    );
    this.ui.elements.video.addEventListener("loadstart", () =>
      this.handleVideoLoadStart()
    );
    this.ui.elements.video.addEventListener("loadedmetadata", () =>
      this.handleVideoLoadedMetadata()
    );
    this.ui.elements.video.addEventListener("loadeddata", () =>
      this.handleVideoLoadedData()
    );
    this.ui.elements.video.addEventListener("canplaythrough", () =>
      this.handleVideoCanPlayThrough()
    );

    // Save playback position periodically
    this.ui.elements.video.addEventListener("timeupdate", () => {
      const t = this.ui.elements.video.currentTime;
      const duration = this.ui.elements.video.duration;
      // Only save if playing, time > 0, and not at end
      if (!this.ui.elements.video.paused && t > 0 && t < duration - 1) {
        localStorage.setItem(this.resumeTimeKey, t);
      }
    });

    // Cleanup on page leave - multiple events to ensure it triggers (if manual cleanup is enabled)
    if (CONFIG.MANUAL_CLEANUP) {
      const cleanupAll = () => {
        this.cleanup();
        // Also clean localStorage for this magnet globally
        window.cleanLocalStorageForMagnet?.(this.magnetUrl);
      };
      window.addEventListener("beforeunload", cleanupAll);
      window.addEventListener("pagehide", cleanupAll);
      window.addEventListener("unload", cleanupAll);
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
  async initialize() {
    try {
      await this.startPlayer();
    } catch (error) {
      this.handleInitializationError(error);
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

      // Set up video
      this.ui.elements.video.src = videoSrc;
      this.ui.elements.video.load();

      // Initialize Plyr player if not already done
      if (!this.playerInitialized) {
        this.plyrInstance = new Plyr(this.ui.elements.video, {
          captions: { active: true, update: true, language: "en" },
          controls: [
            "play-large", // This shows the big play button in the center
            "play",
            "progress",
            "current-time",
            "mute",
            "volume",
            "captions",
            "settings",
            "fullscreen",
          ],
          pip: false,
        });
        this.playerInitialized = true;

        // === custom quality indicator to Plyr controls ===
        setTimeout(() => {
          const controlsBar = document.querySelector(".plyr__controls");
          if (
            controlsBar &&
            !document.getElementById("plyr-quality-indicator")
          ) {
            const qualityIndicator = document.createElement("span");
            qualityIndicator.id = "plyr-quality-indicator";
            qualityIndicator.className = "plyr__quality-indicator";
            qualityIndicator.textContent = "...";
            qualityIndicator.style.margin = "0 0px";
            qualityIndicator.style.color = "#fff";
            qualityIndicator.style.fontWeight = "bold";
            qualityIndicator.style.background = "none";
            qualityIndicator.style.padding = "2px 8px";
            qualityIndicator.style.borderRadius = "4px";
            qualityIndicator.style.fontSize = "13px";
            qualityIndicator.style.pointerEvents = "none";

            const fullscreenBtn = controlsBar.querySelector(
              '.plyr__control[aria-label="Fullscreen"]'
            );
            if (fullscreenBtn) {
              controlsBar.insertBefore(qualityIndicator, fullscreenBtn);
            } else {
              controlsBar.appendChild(qualityIndicator);
            }
          }
          // === Add subtitles section button ===
          if (controlsBar && !document.getElementById("plyr-subtitles-btn")) {
            const subtitlesBtn = document.createElement("button");
            subtitlesBtn.id = "plyr-subtitles-btn";
            subtitlesBtn.className = "plyr__control plyr__subtitles-btn";
            subtitlesBtn.type = "button";
            subtitlesBtn.setAttribute("aria-label", "Subtitles");
            subtitlesBtn.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <g id="cc">
    <path fill="#ffffffff" d="M14,23H6a3,3,0,0,1-3-3V13a3,3,0,0,1,3-3h8a1,1,0,0,1,0,2H6a1,1,0,0,0-1,1v7a1,1,0,0,0,1,1h8a1,1,0,0,1,0,2Z"/>
    <path fill="#ffffffff" d="M28,23H20a3,3,0,0,1-3-3V13a3,3,0,0,1,3-3h8a1,1,0,0,1,0,2H20a1,1,0,0,0-1,1v7a1,1,0,0,0,1,1h8a1,1,0,0,1,0,2Z"/>
  </g>
</svg>`;
            subtitlesBtn.style.margin = "0 8px";
            subtitlesBtn.style.background = "none";
            subtitlesBtn.style.border = "none";
            subtitlesBtn.style.cursor = "pointer";
            subtitlesBtn.style.display = "inline-flex";
            subtitlesBtn.style.alignItems = "center";
            subtitlesBtn.style.justifyContent = "center";
            subtitlesBtn.style.padding = "2px 0px";
            subtitlesBtn.style.borderRadius = "4px";
            subtitlesBtn.style.color = "#fff";
            // Add blue hover effect to match Plyr settings button
            subtitlesBtn.addEventListener("mouseenter", () => {
              subtitlesBtn.style.background = "#03a9f4";
              subtitlesBtn.style.color = "#fff";
              subtitlesBtn.style.padding = "5px 5px 5px 5px";
            });
            subtitlesBtn.addEventListener("mouseleave", () => {
              subtitlesBtn.style.background = "none";
              subtitlesBtn.style.color = "#fff";
            });
            subtitlesBtn.addEventListener("click", () => {
              // Toggle subtitle selector UI
              const selector = document.getElementById(
                "subtitle-selector-container"
              );

              if (selector) {
                const isOpening = selector.style.display === "none";
                selector.style.display = isOpening ? "" : "none";
              }
            });
            // Insert before fullscreen button if present
            const fullscreenBtn = controlsBar.querySelector(
              '.plyr__control[aria-label="Fullscreen"]'
            );
            if (fullscreenBtn) {
              controlsBar.insertBefore(subtitlesBtn, fullscreenBtn);
            } else {
              controlsBar.appendChild(subtitlesBtn);
            }
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

      this.ui.setStatusMessage("");
    } catch (error) {
      throw new Error(`Failed to load video or subtitles: ${error.message}`);
    }
  }

  // Handle status updates from the poller
  handleStatusUpdate(data, errorMsg) {
    if (data) {
      // Check if file was deleted externally
      if (data.fileDeleted) {
        if (CONFIG.DEBUG_MODE)
          console.log("File was deleted externally, cleaning up localStorage");
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

      // Start player when downloading begins
      if (
        (data.status === "downloading" || data.status === "done") &&
        !this.playerStarted
      ) {
        this.playerStarted = true;
        this.startPlayer();
      }

      // Set ready flag for fast start
      if (data.downloaded && data.downloaded > CONFIG.READY_THRESHOLD) {
        localStorage.setItem(this.playerReadyKey, "1");
        this.ui.hideLoading();
      }

      this.ui.setStatusMessage("");
    } else {
      this.ui.updateStatusBar();
      this.ui.setStatusMessage(errorMsg || "");
    }
  }

  // Handle video error event and trigger retry logic
  handleVideoError() {
    if (CONFIG.DEBUG_MODE) console.log("Video error event triggered");
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
    this.ui.updatePlyrLoadingText("Loading video data...");

    // Restore playback position on loadedmetadata
    const resumeTime = parseFloat(localStorage.getItem(this.resumeTimeKey));

    if (
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

      if (CONFIG.DEBUG_MODE) console.log("=== CLEARING LOCALSTORAGE ===");
      if (CONFIG.DEBUG_MODE) console.log("Magnet URL:", this.magnetUrl);
      if (CONFIG.DEBUG_MODE)
        console.log("Player Ready Key:", this.playerReadyKey);
      if (CONFIG.DEBUG_MODE)
        console.log("Resume Time Key:", this.resumeTimeKey);

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
