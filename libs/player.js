/**
 * MKV Video Player Implementation
 * Class-based architecture
 */

// Configuration constants
const CONFIG = {
  MAX_RETRIES: 20,
  BASE_RETRY_DELAY: 2000,
  MAX_RETRY_DELAY: 10000,
  CONTINUOUS_RETRY_INTERVAL: 30000,
  STATUS_POLL_INTERVAL: 1000,
  READY_THRESHOLD: 256 * 1024, // 256KB
  RESOURCE_TIMEOUT: 300, // 150 seconds
  STALL_TIMEOUT: 20000, // 20 seconds
};

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
    this.elements = {
      progressBar: document.getElementById("progress-bar"),
      statusDetails: document.getElementById("status-details"),
      stepDebug: document.getElementById("step-debug"),
      loading: document.getElementById("loading"),
      error: document.getElementById("error"),
      statusMsg: document.getElementById("status-msg"),
      retryBtn: document.getElementById("retry-btn"),
      videoContainer: document.getElementById("video-container"),
      plyrLoadingOverlay: document.getElementById("plyr-loading-overlay"),
      video: document.getElementById("player"),
    };

    this.bindEvents();
  }

  bindEvents() {
    this.elements.retryBtn?.addEventListener("click", () => {
      this.onRetryClick?.();
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
  }

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

    // Add stall warning
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

  showStep(message) {
    if (this.elements.stepDebug) {
      this.elements.stepDebug.textContent = message;
      this.elements.stepDebug.style.display = "";
    }
  }

  hideStep() {
    if (this.elements.stepDebug) {
      this.elements.stepDebug.style.display = "none";
    }
  }

  showError(message) {
    this.elements.error.textContent = message;
    this.elements.error.style.display = "";
  }

  hideError() {
    this.elements.error.style.display = "none";
  }

  showRetryButton() {
    this.elements.retryBtn.style.display = "";
  }

  hideRetryButton() {
    this.elements.retryBtn.style.display = "none";
  }

  showVideoContainer() {
    this.elements.videoContainer.style.display = "";
  }

  hideVideoContainer() {
    this.elements.videoContainer.style.display = "none";
  }

  showPlyrLoadingOverlay() {
    if (this.elements.plyrLoadingOverlay) {
      this.elements.plyrLoadingOverlay.style.display = "";
    }
  }

  hidePlyrLoadingOverlay() {
    if (this.elements.plyrLoadingOverlay) {
      this.elements.plyrLoadingOverlay.style.display = "none";
    }
  }

  updatePlyrLoadingText(text) {
    const textElement =
      this.elements.plyrLoadingOverlay?.querySelector(".plyr-loading-text");
    if (textElement) {
      textElement.textContent = text;
    }
  }

  hideLoading() {
    this.elements.loading.style.display = "none";
  }

  setStatusMessage(message) {
    this.elements.statusMsg.innerHTML = message;
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

  reset() {
    this.retryCount = 0;
    this.clearContinuousRetry();
  }

  getRetryDelay() {
    return Math.min(
      CONFIG.BASE_RETRY_DELAY + this.retryCount * 500,
      CONFIG.MAX_RETRY_DELAY
    );
  }

  shouldRetry() {
    return this.retryCount < this.maxRetries;
  }

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

  startContinuousRetry(retryFn, onStep) {
    this.retryInterval = setInterval(() => {
      onStep?.("Continuous retry: Reloading video...");
      retryFn();
    }, CONFIG.CONTINUOUS_RETRY_INTERVAL);
  }

  clearContinuousRetry() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

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

  stop() {
    this.isActive = false;
  }

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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Resource Loader - Handles loading of video and subtitle resources
 */
class ResourceLoader {
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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Subtitles Manager - Handles subtitle initialization
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

    this.bindEvents();
    this.checkInitialState();
  }

  bindEvents() {
    // Bind UI events
    this.ui.onRetryClick = () => this.handleManualRetry();

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

    // Cleanup on page leave
    window.addEventListener("pagehide", () => this.cleanup());
  }

  checkInitialState() {
    if (localStorage.getItem(this.playerReadyKey) === "1") {
      document.addEventListener("DOMContentLoaded", () => {
        this.ui.hideLoading();
        this.ui.elements.video.style.display = "";
      });
    }
  }

  async initialize() {
    try {
      await this.startPlayer();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

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

      // Initialize Plyr
      if (!this.playerInitialized) {
        this.plyrInstance = new Plyr(this.ui.elements.video, {
          captions: { active: true, update: true, language: "en" },
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

  handleStatusUpdate(data, errorMsg) {
    if (data) {
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

  handleVideoCanPlay() {
    this.ui.hideLoading();
    this.ui.showVideoContainer();
    this.ui.hidePlyrLoadingOverlay();
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

  handleVideoLoadStart() {
    this.ui.updatePlyrLoadingText("Loading video...");
  }

  handleVideoLoadedMetadata() {
    this.ui.updatePlyrLoadingText("Loading video data...");
  }

  handleVideoLoadedData() {
    this.ui.updatePlyrLoadingText("Preparing video...");
  }

  handleVideoCanPlayThrough() {
    this.ui.hidePlyrLoadingOverlay();
  }

  handleManualRetry() {
    this.ui.hideRetryButton();
    this.ui.hideError();
    this.retryController.reset();
    this.ui.showStep("Manual retry triggered");
    this.ui.elements.video.load();
  }

  handleInitializationError(error) {
    this.ui.hideLoading();
    this.ui.showError(error.message);
    this.ui.showStep(`Player error: ${error.message}`);
    this.statusPoller.stop();
  }

  cleanup() {
    this.statusPoller.stop();
    this.retryController.clearContinuousRetry();
    this.subtitlesManager.dispose();

    // Send goodbye beacon
    navigator.sendBeacon(`/goodbye?url=${encodeURIComponent(this.magnetUrl)}`);
  }
}
