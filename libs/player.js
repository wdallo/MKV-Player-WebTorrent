/**
 * MKV Video Player Implementation
 * Class-based architecture
 */

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
      try {
        const response = await fetch(url, { method: "GET" });

        if (response.status === 200) {
          return isText ? await response.text() : url;
        } else if (response.status === 503) {
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
 * Subtitles Manager - Handles subtitle initialization and updates
 */
class SubtitlesManager {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.initialized = false;
    this.octopus = null;
    this.lastSubtitleContent = "";
    this.pollInterval = null;
    this.subtitlesUrl = null;
  }

  // Initialize subtitles rendering (ASS/SSA)
  async initialize(subtitleContent, subtitlesUrl) {
    this.subtitlesUrl = subtitlesUrl;
    this.lastSubtitleContent = subtitleContent;

    if (!subtitleContent || subtitleContent.indexOf("[Script Info]") === -1) {
      // Handle VTT fallback if needed
      return;
    }

    if (typeof window.SubtitlesOctopus !== "undefined") {
      this.octopus = new window.SubtitlesOctopus({
        video: this.videoElement,
        subContent: subtitleContent,
        workerUrl: "/libs/subtitles-octopus-worker.js",
        fonts: [],
        fallbackFont: "/libs/ARIALBD.TTF",
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
        const response = await fetch(this.subtitlesUrl, { cache: "no-store" });
        if (response.status === 200) {
          const newContent = await response.text();
          if (newContent.length > this.lastSubtitleContent.length) {
            // Dispose and re-init with new content
            this.dispose();
            this.initialize(newContent, this.subtitlesUrl);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }, 2000); // Check every 2 seconds
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
}

/**
 * Main Video Player Controller
 */
class VideoPlayerController {
  constructor(magnetUrl) {
    this.magnetUrl = magnetUrl;
    this.playerReadyKey = `playerReady_${magnetUrl}`;
    this.resumeTimeKey = `resumeTime_${magnetUrl}`;

    // Initialize components
    this.ui = new UIController();
    this.retryController = new RetryController();
    this.statusPoller = new StatusPoller(magnetUrl);
    this.resourceLoader = new ResourceLoader();
    this.subtitlesManager = new SubtitlesManager(this.ui.elements.video);

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
      console.log(
        "Manual cleanup enabled - files will be deleted when player is closed"
      );
    } else {
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
            "play",
            "progress",
            "current-time",
            "mute",
            "volume",
            "captions",
            "settings",
            "fullscreen",
          ],
          pip: false, // Explicitly disable PiP API
        });
        this.playerInitialized = true;
      }

      this.ui.elements.video.classList.remove("hidden-until-plyr");

      // Initialize subtitles if available
      if (subtitleContent) {
        await this.subtitlesManager.initialize(subtitleContent, subtitlesUrl);
        this.subtitlesLoaded = true;
        this.ui.showStep("SubtitlesOctopus initialized");
      } else {
        this.subtitlesLoaded = false;
        this.ui.showStep(
          "Subtitles not ready yet, will try again when video is ready"
        );
      }

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
        console.log("=== FRESH DOWNLOAD DETECTED ===");
        console.log("Status:", data.status);
        console.log("Progress:", data.progress);
        console.log("Downloaded:", data.downloaded);
        console.log("Has seen progress before:", this.hasSeenDownloadProgress);
        console.log(
          "Download starting from zero, clearing old localStorage data"
        );
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
    console.log("Video error event triggered");
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
      const subtitlesUrl = `/subtitles?url=${encodeURIComponent(
        this.magnetUrl
      )}`;
      this.resourceLoader
        .pollUntilReady(subtitlesUrl, true)
        .then((subtitleContent) => {
          if (subtitleContent) {
            this.subtitlesManager.initialize(subtitleContent, subtitlesUrl);
            this.subtitlesLoaded = true;
            this.ui.showStep("Subtitles loaded after video ready");
          }
        })
        .catch(() => {
          // Ignore if still not ready
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
      console.log("Manual cleanup is disabled - skipping immediate cleanup");
      this.statusPoller.stop();
      this.retryController.clearContinuousRetry();
      this.subtitlesManager.dispose();
      return;
    }

    console.log(
      "Manual cleanup enabled - sending goodbye beacon for:",
      this.magnetUrl
    );
    this.statusPoller.stop();
    this.retryController.clearContinuousRetry();
    this.subtitlesManager.dispose();

    // Send goodbye beacon to server to clean up torrent/files
    // Use URL parameter instead of FormData for better compatibility
    const encodedUrl = encodeURIComponent(this.magnetUrl);
    const goodbyeUrl = `/goodbye?url=${encodedUrl}`;

    // Try multiple approaches to ensure cleanup happens
    try {
      // Method 1: sendBeacon with URL parameter (preferred)
      const sent = navigator.sendBeacon(goodbyeUrl);
      console.log("SendBeacon result:", sent);

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
      console.error("Cleanup beacon failed:", err);
      // Method 3: Last resort - synchronous XHR with URL parameter
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", goodbyeUrl, false); // synchronous
        xhr.send();
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.shouldClearLocalStorage && response.magnet) {
              console.log(
                "Server requested localStorage cleanup for:",
                response.magnet
              );
              this.clearLocalStorageData();
            }
          } catch (parseErr) {
            console.log("Could not parse cleanup response");
          }
        }
      } catch (xhrErr) {
        console.error("XHR cleanup failed:", xhrErr);
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

      console.log("=== CLEARING LOCALSTORAGE ===");
      console.log("Magnet URL:", this.magnetUrl);
      console.log("Player Ready Key:", this.playerReadyKey);
      console.log("Resume Time Key:", this.resumeTimeKey);

      if (localStorage.getItem(this.playerReadyKey)) {
        localStorage.removeItem(this.playerReadyKey);
        removedKeys.push(this.playerReadyKey);
        console.log("Removed playerReady key:", this.playerReadyKey);
      }

      if (localStorage.getItem(this.resumeTimeKey)) {
        localStorage.removeItem(this.resumeTimeKey);
        removedKeys.push(this.resumeTimeKey);
        console.log("Removed resumeTime key:", this.resumeTimeKey);
      }

      // Look for keys that contain this exact magnet URL or its hash
      const magnetHash = this.magnetUrl.split("btih:")[1]?.split("&")[0];
      const keysToRemove = [];

      console.log("Scanning localStorage for magnet-related keys...");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          console.log(`Checking key: ${key}`);
          if (
            key.includes(this.magnetUrl) ||
            (magnetHash && key.includes(magnetHash)) ||
            key === this.playerReadyKey ||
            key === this.resumeTimeKey
          ) {
            keysToRemove.push(key);
            console.log(`Key marked for removal: ${key}`);
          }
        }
      }

      keysToRemove.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          removedKeys.push(key);
          console.log(`Removed key: ${key}`);
        }
      });

      console.log(`Total removed keys: ${removedKeys.length}`);
      console.log("Removed keys:", removedKeys);
      console.log("=== CLEANUP COMPLETE ===");
    } catch (err) {
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

    if (fsElement) {
      this.enterFullscreen(fsElement);
    } else {
      this.exitFullscreen();
    }
  }

  // Configure elements for fullscreen mode
  enterFullscreen(fsElement) {
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
  }

  // Restore elements to normal container when exiting fullscreen
  exitFullscreen() {
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
  }
}

/**
 * Utility function to clean localStorage for any magnet URL
 * Can be called from browser console: cleanLocalStorageForMagnet('magnet:?xt=...')
 */
window.cleanLocalStorageForMagnet = function (magnetUrl) {
  if (!magnetUrl) {
    console.error("Please provide a magnet URL");
    return;
  }

  try {
    console.log("=== GLOBAL CLEANUP FUNCTION ===");
    console.log("Target magnet:", magnetUrl);

    const removedKeys = [];
    const magnetHash = magnetUrl.split("btih:")[1]?.split("&")[0];
    const keysToRemove = [];

    console.log("Extracted hash:", magnetHash);
    console.log("Current localStorage size:", localStorage.length);

    // Find all keys related to this magnet
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        console.log(`Checking key: ${key}`);
        if (
          key.includes(magnetUrl) ||
          (magnetHash && key.includes(magnetHash))
        ) {
          keysToRemove.push(key);
          console.log(`Key marked for removal: ${key}`);
        }
      }
    }

    console.log(`Found ${keysToRemove.length} keys to remove`);

    // Remove all found keys
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      removedKeys.push(key);
      console.log(`Removed key: ${key}`);
    });

    console.log(
      `Cleaned ${removedKeys.length} localStorage keys for magnet:`,
      magnetUrl
    );
    console.log("Removed keys:", removedKeys);
    console.log("=== GLOBAL CLEANUP COMPLETE ===");
    return { success: true, removedKeys };
  } catch (err) {
    console.error("Failed to clean localStorage:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Global cleanup notification system
 * Allows server or other sources to trigger localStorage cleanup for all users
 */
window.notifyMagnetDeleted = function (magnetUrl) {
  if (!magnetUrl) {
    console.error("Please provide a magnet URL");
    return;
  }

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
