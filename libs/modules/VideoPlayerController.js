/**
 * Video Player Controller Module
 * Main controller for the video player
 */

import { isValidMagnet } from "../../utils/magnetValidator.js";
import {
  PLAYER_CONFIG,
  PLYR_CONFIG,
  PLYR_THEME,
} from "../../configs/all.config.js";
import { UIController } from "./UIController.js";
import { RetryController } from "./RetryController.js";
import { StatusPoller } from "./StatusPoller.js";
import { ResourceLoader } from "./ResourceLoader.js";
import { SubtitlesManager } from "./SubtitlesManager.js";
import { AudioManager } from "./AudioManager.js";
import { FullscreenController } from "./FullscreenController.js";
import { ChromeResourceManager } from "./ChromeResourceManager.js";
import { addToPlyrControlsBar } from "./utils.js";

const CONFIG = PLAYER_CONFIG;

export class VideoPlayerController {
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
    const video = this.ui.elements.video;
    if (video && isFinite(video.duration)) {
      this.previousDuration = video.duration;
    }
    if (!video) return;

    // Save current time and paused state
    const currentTime = video.currentTime;
    const wasPaused = video.paused;

    // Suppress resume prompt before switching audio
    this.suppressResumePromptForNextLoad();

    // Set flag to prevent showing overlay during audio switch
    this._audioSwitchInProgress = true;

    // Show overlay during audio switch
    this.ui.overlay.show("Switching audio track...");

    try {
      // Build new video URL with audioTrack param
      const magnetUrl = this.magnetUrl;
      let videoUrl = `/video?url=${encodeURIComponent(magnetUrl)}`;
      if (trackIndex && trackIndex !== "0") {
        videoUrl += `&audioTrack=${trackIndex}`;
      }

      // Wait for resource to be ready (transcoding may take time)
      this.ui.overlay.show("Transcoding audio track, please wait...");
      const readyUrl = await this.resourceLoader.pollUntilReady(
        videoUrl,
        false,
      );

      // Set new src and reload
      video.src = readyUrl;
      video.load();

      // Restore time and play state after loadedmetadata
      video.onloadedmetadata = () => {
        // Wait for canplay event before seeking to ensure stream is ready
        const onCanPlay = () => {
          video.currentTime = currentTime;
          console.log(`[AUDIO] Restored playback position to: ${currentTime}s`);
          if (!wasPaused) {
            video.play().catch((e) => {
              console.warn("[AUDIO] Play failed after switch:", e);
            });
          }
          this.ui.overlay.hide();
          this._audioSwitchInProgress = false;
          video.removeEventListener("canplay", onCanPlay);
        };

        video.addEventListener("canplay", onCanPlay);

        // Re-enable resume prompt after audio switch
        setTimeout(() => {
          this._suppressResumePrompt = false;
        }, 1000);
        video.onloadedmetadata = null;
      };
    } catch (error) {
      console.error("[AUDIO] Failed to switch audio track:", error);
      this.ui.overlay.hide();
      this._audioSwitchInProgress = false;
      this.ui.showError("Failed to switch audio track. Please try again.");
    }
  }

  constructor(magnetUrl) {
    console.log(
      "[PLAYER] VideoPlayerController constructor called with magnet:",
      magnetUrl,
    );
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

    console.log("[PLAYER] Creating UIController...");
    // Initialize components
    this.ui = new UIController();
    console.log("[PLAYER] UIController created successfully");
    this.retryController = new RetryController();
    this.statusPoller = new StatusPoller(magnetUrl);
    this.resourceLoader = new ResourceLoader();
    this.subtitlesManager = new SubtitlesManager(
      this.ui.elements.video,
      magnetUrl,
      this.ui, // Pass UIController for overlay access
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
          "An unexpected error occurred. Please refresh the page.",
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
            "Another tab cleaned up this magnet, cleaning up localStorage",
          );
        this.clearLocalStorageData();
        this.ui.showError(
          "Files were deleted from another tab. Please reload.",
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
      passiveOptions,
    );
    video.addEventListener(
      "loadstart",
      () => this.handleVideoLoadStart(),
      passiveOptions,
    );
    video.addEventListener(
      "loadedmetadata",
      () => this.handleVideoLoadedMetadata(),
      passiveOptions,
    );
    video.addEventListener(
      "loadeddata",
      () => this.handleVideoLoadedData(),
      passiveOptions,
    );
    video.addEventListener(
      "canplaythrough",
      () => this.handleVideoCanPlayThrough(),
      passiveOptions,
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
      passiveOptions,
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
          "Manual cleanup enabled - files will be deleted when player is closed",
        );
    } else {
      if (CONFIG.DEBUG_MODE)
        console.log(
          `Manual cleanup disabled - files will auto-delete after ${CONFIG.AUTO_DELETE_HOURS} hours`,
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

  // Apply Plyr theme colors as CSS custom properties
  applyPlyrTheme() {
    const root = document.documentElement;

    root.style.setProperty("--plyr-color-main", PLYR_THEME.primaryColor);
    root.style.setProperty(
      "--plyr-video-background",
      PLYR_THEME.videoBackground,
    );
    root.style.setProperty("--plyr-menu-background", PLYR_THEME.menuBackground);
    root.style.setProperty("--plyr-menu-shadow", PLYR_THEME.menuShadow);
    root.style.setProperty("--plyr-menu-color", PLYR_THEME.textColor);
    root.style.setProperty("--plyr-video-control-color", PLYR_THEME.textColor);
    root.style.setProperty(
      "--plyr-video-control-color-hover",
      PLYR_THEME.textColor,
    );
    root.style.setProperty(
      "--plyr-video-control-background-hover",
      PLYR_THEME.controlBackgroundHover,
    );
    root.style.setProperty(
      "--plyr-tooltip-background",
      PLYR_THEME.tooltipBackground,
    );
    root.style.setProperty("--plyr-tooltip-color", PLYR_THEME.tooltipColor);
    root.style.setProperty("--plyr-control-icon-size", PLYR_THEME.iconSize);
    root.style.setProperty(
      "--plyr-control-icon-size-large",
      PLYR_THEME.iconSizeLarge || "24px",
    );
    root.style.setProperty("--plyr-control-spacing", "8px");
    root.style.setProperty("--plyr-control-radius", PLYR_THEME.borderRadius);

    // Apply control size and reduced range sizing
    root.style.setProperty("--plyr-control-size", PLYR_THEME.controlSize);
    root.style.setProperty("--plyr-range-track-height", "4px");
    root.style.setProperty("--plyr-range-thumb-height", "10px");
    root.style.setProperty("--plyr-range-thumb-width", "10px");

    root.style.setProperty(
      "--plyr-range-fill-background",
      PLYR_THEME.primaryColor,
    );
    root.style.setProperty(
      "--plyr-video-progress-buffered-background",
      PLYR_THEME.bufferColor,
    );
    root.style.setProperty(
      "--plyr-range-track-background",
      PLYR_THEME.sliderTrackColor,
    );
    root.style.setProperty(
      "--plyr-video-controls-background",
      PLYR_THEME.controlBackground,
    );
    root.style.setProperty(
      "--plyr-badge-background",
      PLYR_THEME.badgeBackground,
    );
    root.style.setProperty(
      "--plyr-badge-text-color",
      PLYR_THEME.badgeTextColor,
    );
    root.style.setProperty("--plyr-tab-focus-color", PLYR_THEME.focusColor);
    root.style.setProperty("--plyr-font-family", PLYR_THEME.fontFamily);
    root.style.setProperty("--plyr-font-size-small", PLYR_THEME.fontSizeSmall);
    root.style.setProperty("--plyr-font-size-base", PLYR_THEME.fontSizeBase);
    root.style.setProperty("--plyr-font-size-large", PLYR_THEME.fontSizeLarge);

    // Additional control bar sizing
    root.style.setProperty("--plyr-video-controls-height", "36px");
    root.style.setProperty("--plyr-control-padding", "4px 6px");
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
          tag,
        );
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
        return element;
      };

      // Fix play button (triangle)
      const playBtn = container.querySelector('[data-plyr="play"]');
      if (playBtn) {
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

      // Fix large play button (triangle)
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

      // Fix pause button
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

      // Fix mute button (volume icon)
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

      // Fix fullscreen button (single icon)
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

      // Remove duplicate controls that might exist
      const allControls = container.querySelectorAll(".plyr__control");
      allControls.forEach((control) => {
        const svgs = control.querySelectorAll("svg");
        if (svgs.length > 1) {
          for (let i = 1; i < svgs.length; i++) {
            svgs[i].remove();
          }
        }
      });
    }, 100);
  }

  async initialize() {
    console.log("[PLAYER] initialize() called");
    try {
      // Check if there was a constructor error
      if (this.error) {
        this.handleInitializationError(new Error(this.error));
        return;
      }

      console.log("[PLAYER] Starting player...");
      // Start the player first (it has its own loading overlay)
      await this.startPlayer();
      console.log("[PLAYER] Player started, waiting for video to be ready...");

      // Wait for video to have at least some metadata loaded
      const video = this.ui.elements.video;
      if (video.readyState < 1) {
        // HAVE_METADATA = 1
        console.log("[PLAYER] Waiting for loadedmetadata event...");
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log("[PLAYER] loadedmetadata timeout, proceeding anyway");
            resolve();
          }, 10000); // 10 second timeout

          video.addEventListener(
            "loadedmetadata",
            () => {
              clearTimeout(timeout);
              console.log("[PLAYER] loadedmetadata event fired");
              resolve();
            },
            { once: true },
          );
        });
      }

      console.log("[PLAYER] Video ready, beginning subtitle/audio checks...");

      // Get overlay instance after player is started
      const overlay = this.ui.overlay;
      console.log("[PLAYER] Got overlay instance:", !!overlay);

      // Check if subtitles exist
      if (this.subtitlesManager) {
        console.log("[PLAYER] Checking subtitles...");
        overlay.show("Checking for subtitles...");

        let subtitlesAvailable = false;
        let attemptCount = 0;
        const maxAttempts = 2;

        while (attemptCount < maxAttempts && !subtitlesAvailable) {
          attemptCount++;

          if (attemptCount > 1) {
            overlay.show(
              `Checking for subtitles... (attempt ${attemptCount}/${maxAttempts})`,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          subtitlesAvailable = await this.checkSubtitlesAvailable();
        }

        if (subtitlesAvailable) {
          overlay.show("Subtitles found, loading SubtitlesOctopus...");

          // Wait for SubtitlesOctopus to be ready
          const waitForOctopus = async () => {
            return new Promise((resolve) => {
              let attempts = 0;
              const maxWait = 20; // 10 seconds total (20 × 500ms)

              const checkOctopus = () => {
                const subtitles = this.subtitlesManager;
                if (subtitles && subtitles.octopusReady) {
                  resolve(true);
                } else if (attempts++ >= maxWait) {
                  resolve(false);
                } else {
                  setTimeout(checkOctopus, 500);
                }
              };
              checkOctopus();
            });
          };

          const octopusReady = await waitForOctopus();
          if (octopusReady) {
            overlay.show("SubtitlesOctopus loaded successfully!");
          } else {
            overlay.show("Subtitles partially loaded, proceeding...");
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          overlay.show("No subtitles found, proceeding without subtitles...");
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Check if multi audio tracks exist
      if (this.audioManager) {
        overlay.show("Checking for audio tracks...");

        let audioTracksAvailable = false;
        let audioAttemptCount = 0;
        const maxAudioAttempts = 2;

        while (audioAttemptCount < maxAudioAttempts && !audioTracksAvailable) {
          audioAttemptCount++;

          if (audioAttemptCount > 1) {
            overlay.show(
              `Checking for audio tracks... (attempt ${audioAttemptCount}/${maxAudioAttempts})`,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          try {
            await this.audioManager.initialize();
            const audioTracks = this.audioManager.availableTracks || [];
            audioTracksAvailable = audioTracks.length > 1;
          } catch (error) {
            console.log(
              `Audio track check attempt ${audioAttemptCount} failed:`,
              error,
            );
          }
        }

        if (audioTracksAvailable) {
          overlay.show("Multi audio tracks found!");
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          overlay.show("Single audio track detected, proceeding...");
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Hide overlay after all checks complete
      console.log("[PLAYER] All checks complete, hiding overlay");
      overlay.hide();
      console.log("[PLAYER] Initialize complete!");
    } catch (error) {
      console.error("[PLAYER] Error in initialize():", error);
      this.handleInitializationError(error);
      // Make sure to hide overlay on error too
      if (this.ui && this.ui.overlay) {
        this.ui.overlay.hide();
      }
    }
  }

  // Handle initialization errors gracefully
  handleInitializationError(error) {
    console.error("Player initialization failed:", error);

    // Show user-friendly error message
    if (this.ui && this.ui.overlay) {
      this.ui.overlay.show(`Failed to initialize player: ${error.message}`);
      setTimeout(() => {
        this.ui.overlay.hide();
        this.ui.showError(`Failed to initialize player: ${error.message}`);
      }, 3000);
    } else if (this.ui) {
      this.ui.showError(`Failed to initialize player: ${error.message}`);
      this.ui.hidePlyrLoadingOverlay();
    } else {
      // Fallback if UI is not available - use #overlay directly
      const overlay = document.getElementById("overlay");
      if (overlay) {
        overlay.style.display = "flex";
        overlay.innerHTML = "";

        const errorContainer = document.createElement("div");
        errorContainer.style.textAlign = "center";
        errorContainer.style.color = "#fff";
        errorContainer.style.padding = "20px";

        const iconDiv = document.createElement("div");
        iconDiv.textContent = "⚠️";
        iconDiv.style.fontSize = "2em";
        iconDiv.style.marginBottom = "10px";

        const titleDiv = document.createElement("div");
        titleDiv.textContent = "Player Error";
        titleDiv.style.fontSize = "1.2em";
        titleDiv.style.marginBottom = "10px";

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

    if (this.playerInitialized) {
      this.ui.showVideoContainer();
      return;
    }

    this.ui.showVideoContainer();

    // Start status polling
    this.statusPoller.start((data, errorMsg) => {
      this.handleStatusUpdate(data, errorMsg);
    });

    try {
      // Load resources
      const videoUrl = `/video?url=${encodeURIComponent(this.magnetUrl)}`;
      const subtitlesUrl = `/subtitles?url=${encodeURIComponent(
        this.magnetUrl,
      )}`;

      const [videoSrc, subtitleContent] = await Promise.all([
        this.resourceLoader.pollUntilReady(videoUrl, false),
        this.resourceLoader
          .pollUntilReady(subtitlesUrl, true)
          .catch(() => null),
      ]);

      console.log(
        "[PLAYER] videoSrc received:",
        videoSrc,
        "type:",
        typeof videoSrc,
      );

      // Set up video with error handling and resource optimization
      try {
        ChromeResourceManager.optimizeVideo(this.ui.elements.video);

        console.log("[PLAYER] Setting video.src to:", videoSrc);
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
            `Failed to initialize video player: ${error.message}`,
          );
          throw error;
        }

        // Add custom quality indicator to Plyr controls
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
        // Only auto-load if user hasn't made a selection yet
        if (this.subtitlesManager.userSelectedTrack === null) {
          await this.subtitlesManager.initialize(subtitleContent, subtitlesUrl);
          this.subtitlesLoaded = true;
          // Note: currentTrack is already set to 0 by SubtitlesManager constructor
          // userSelectedTrack stays null to indicate auto-loaded default
        }
      } else {
        this.subtitlesLoaded = false;
        // If no subtitle content, disable subtitles
        this.subtitlesManager.currentTrack = null;
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
              "File was deleted externally, cleaning up localStorage",
            );
          this.clearLocalStorageData();
          this.ui.showError(
            "Video file was deleted. Please reload with a new torrent.",
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
          this.hasSeenDownloadProgress = true;
        }

        this.ui.updateStatusBar(data);

        // Start player when downloading begins
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
              storageError,
            );
            this.ui.hideLoading();
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
      this.ui.showError(
        "An error occurred during status update. Please refresh.",
      );
    }
  }

  // Handle video error event and trigger retry logic
  handleVideoError() {
    const video = this.ui.elements.video;
    console.log("Video error event triggered");

    if (video.error) {
      console.error(
        "[VIDEO ERROR] Code:",
        video.error.code,
        "Message:",
        video.error.message,
      );
      console.error(
        "[VIDEO ERROR] Network state:",
        video.networkState,
        "Ready state:",
        video.readyState,
      );
      console.error(
        "[VIDEO ERROR] Current src:",
        video.currentSrc || video.src,
      );
    }

    if (ChromeResourceManager.monitorMemory()) {
      console.warn("Video error may be due to high memory usage");
      ChromeResourceManager.forceGarbageCollection();
    }

    this.ui.showError("Video loading... (will retry automatically)");
    this.ui.showRetryButton();

    this.retryController.executeRetry(
      () => this.ui.elements.video.load(),
      () => {}, // No-op callback instead of showStep
    );
  }

  // Handle video canplay event (ready to play)
  handleVideoCanPlay() {
    this.ui.hideLoading();
    // Don't hide overlay here - let initialize() handle it after subtitle/audio checks
    // this.ui.hidePlyrLoadingOverlay();
    this.ui.showVideoContainer();
    this.ui.hideError();
    this.ui.hideRetryButton();
    this.ui.hideStep();

    this.retryController.reset();

    // Try to load subtitles if not loaded yet
    if (!this.subtitlesLoaded) {
      this.subtitlesManager.fetchAvailableTracks().then(() => {
        const subtitlesUrl = `/subtitles?url=${encodeURIComponent(
          this.magnetUrl,
        )}&track=0`;
        const urlWithTimestamp = subtitlesUrl + "&_t=" + Date.now();
        this.resourceLoader
          .pollUntilReady(urlWithTimestamp, true)
          .then((subtitleContent) => {
            if (subtitleContent) {
              this.subtitlesManager.initialize(subtitleContent, subtitlesUrl);
              this.subtitlesLoaded = true;
              // currentTrack already set by constructor, don't override
            } else {
              this.subtitlesManager.currentTrack = null;
            }
            this.subtitlesManager.createSubtitleSelector();
          })
          .catch(() => {
            this.subtitlesManager.currentTrack = null;
            this.subtitlesManager.createSubtitleSelector();
          });
      });
    }
  }

  // Handle video loadstart event
  handleVideoLoadStart() {
    // Don't show overlay if audio switch is in progress
    if (this._audioSwitchInProgress) {
      return;
    }
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
            this.originalDuration,
          );
      }

      // Fallback: if duration is null, NaN, or Infinity after loadedmetadata, use originalDuration
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
    // Don't show overlay if audio switch is in progress
    if (!this._audioSwitchInProgress) {
      this.ui.updatePlyrLoadingText("Loading video data...");
    }

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

    // Load video quality
    const height = this.ui.elements.video.videoHeight;
    const indicator = document.getElementById("plyr-quality-indicator");
    if (indicator && height) {
      indicator.textContent = `${height}p`;
    }

    // Update duration display
    const duration = this.ui.elements.video.duration;
    const durationDisplay = document.querySelector(
      ".plyr__time--duration, .plyr__duration",
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
    // Don't show overlay if audio switch is in progress
    if (this._audioSwitchInProgress) {
      return;
    }
    this.ui.updatePlyrLoadingText("Preparing video...");
  }

  // Handle video canplaythrough event
  handleVideoCanPlayThrough() {
    // Don't hide overlay here - let initialize() handle it after subtitle/audio checks
    // this.ui.hidePlyrLoadingOverlay();
  }

  // Handle manual retry button click
  handleManualRetry() {
    this.ui.hideRetryButton();
    this.ui.hideError();
    this.retryController.reset();
    this.ui.elements.video.load();
  }

  // Handle resume button click
  handleResumeClick() {
    console.log("[PLAYER] handleResumeClick called", {
      pendingResumeTime: this._pendingResumeTime,
      videoDuration: this.ui.elements.video.duration,
    });

    this.ui.hideResumeButton();
    if (
      this._pendingResumeTime &&
      this.ui.elements.video.duration > this._pendingResumeTime
    ) {
      console.log("[PLAYER] Setting currentTime to:", this._pendingResumeTime);
      this.ui.elements.video.currentTime = this._pendingResumeTime;

      if (this.ui.elements.video.paused) {
        console.log("[PLAYER] Playing video");
        this.ui.elements.video.play();
      }
    } else {
      console.log("[PLAYER] Invalid resume time or duration");
    }
  }

  // Handle restart button click
  handleRestartClick() {
    console.log("[PLAYER] handleRestartClick called");
    this.ui.elements.video.currentTime = 0;
    this.ui.hideResumeButton();
    localStorage.removeItem(this.resumeTimeKey);
    if (this.ui.elements.video.paused) {
      console.log("[PLAYER] Playing video from start");
      this.ui.elements.video.play();
    }
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
        this.magnetUrl,
      );
    this.statusPoller.stop();
    this.retryController.clearContinuousRetry();
    this.subtitlesManager.cleanup();
    this.audioManager.cleanup();

    this.ui.cleanup();

    // Send goodbye beacon to server
    const encodedUrl = encodeURIComponent(this.magnetUrl);
    const goodbyeUrl = `/goodbye?url=${encodedUrl}`;

    try {
      const sent = navigator.sendBeacon(goodbyeUrl);
      if (CONFIG.DEBUG_MODE) console.log("SendBeacon result:", sent);

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
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", goodbyeUrl, false);
        xhr.send();
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.shouldClearLocalStorage && response.magnet) {
              if (CONFIG.DEBUG_MODE)
                console.log(
                  "Server requested localStorage cleanup for:",
                  response.magnet,
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
      }

      if (localStorage.getItem(this.playerReadyKey)) {
        localStorage.removeItem(this.playerReadyKey);
        removedKeys.push(this.playerReadyKey);
      }

      if (localStorage.getItem(this.resumeTimeKey)) {
        localStorage.removeItem(this.resumeTimeKey);
        removedKeys.push(this.resumeTimeKey);
      }

      const magnetHash = this.magnetUrl.split("btih:")[1]?.split("&")[0];
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (
            key.includes(this.magnetUrl) ||
            (magnetHash && key.includes(magnetHash)) ||
            key === this.playerReadyKey ||
            key === this.resumeTimeKey
          ) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          removedKeys.push(key);
        }
      });

      if (CONFIG.DEBUG_MODE) {
        console.log(`Total removed keys: ${removedKeys.length}`);
        console.log("=== CLEANUP COMPLETE ===");
      }
    } catch (err) {
      if (CONFIG.DEBUG_MODE)
        console.error("Failed to clear localStorage:", err);
    }
  }

  // Check if subtitles are available for the current video
  async checkSubtitlesAvailable() {
    try {
      if (!this.subtitlesManager) {
        return false;
      }

      const tracks = await this.subtitlesManager.fetchAvailableTracks();

      const hasSubtitleContent =
        this.subtitlesLoaded ||
        (this.subtitlesManager.subtitlesUrl &&
          this.subtitlesManager.subtitlesUrl.length > 0);
      const hasAvailableTracks = tracks && tracks.length > 0;

      if (CONFIG.DEBUG_MODE) {
        console.log("Subtitle availability check:", {
          hasSubtitleContent,
          hasAvailableTracks,
          tracksCount: tracks ? tracks.length : 0,
        });
      }

      return hasSubtitleContent || hasAvailableTracks;
    } catch (error) {
      if (CONFIG.DEBUG_MODE) {
        console.error("Error checking subtitle availability:", error);
      }
      return false;
    }
  }

  // Wait for subtitle status to become active
  async waitForSubtitleStatus(maxWaitTime = 30000, checkInterval = 1000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkStatus = () => {
        try {
          if (Date.now() - startTime > maxWaitTime) {
            if (CONFIG.DEBUG_MODE) {
              console.warn(
                "Subtitle status check timed out after",
                maxWaitTime,
                "ms",
              );
            }
            resolve(false);
            return;
          }

          if (!this.subtitlesManager) {
            resolve(false);
            return;
          }

          const subtitles = this.subtitlesManager;

          const hasInitializedSubtitles = subtitles.initialized;
          const hasActiveTrack =
            subtitles.currentTrack !== null &&
            subtitles.currentTrack !== undefined;
          const hasSubtitleUrl = subtitles.subtitlesUrl;
          const hasOctopus = subtitles.octopus !== null;
          const isOctopusReady = subtitles.octopusReady;
          const hasAvailableTracks =
            subtitles.availableTracks && subtitles.availableTracks.length > 0;

          const octopusSubtitlesReady =
            hasOctopus && isOctopusReady && hasSubtitleUrl;
          const trackSubtitlesReady =
            hasAvailableTracks || (hasInitializedSubtitles && hasSubtitleUrl);

          const subtitlesReady = octopusSubtitlesReady || trackSubtitlesReady;

          if (subtitlesReady) {
            if (CONFIG.DEBUG_MODE) {
              console.log("✅ Subtitles are now ready");
            }
            resolve(true);
            return;
          }

          setTimeout(checkStatus, checkInterval);
        } catch (error) {
          if (CONFIG.DEBUG_MODE) {
            console.error("Error checking subtitle status:", error);
          }
          resolve(false);
        }
      };

      checkStatus();
    });
  }
}
