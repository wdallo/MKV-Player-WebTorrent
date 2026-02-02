/**
 * Subtitles Manager Module
 * Handles subtitle initialization and updates with multi-track support
 */

import { PLAYER_CONFIG } from "../../configs/all.config.js";
import { UI } from "./constants.js";
import { overlayManager } from "./OverlayManager.js";

const CONFIG = PLAYER_CONFIG;

export class SubtitlesManager {
  constructor(videoElement, magnetUrl, uiController = null) {
    this.videoElement = videoElement;
    this.magnetUrl = magnetUrl;
    this.uiController = uiController; // Reference to UIController for overlay access
    this.initialized = false;
    this.octopus = null;
    this.octopusReady = false;
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
        `/subtitle-tracks?url=${encodeURIComponent(this.magnetUrl)}`,
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
            response.status,
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
        "M14,23H6a3,3,0,0,1-3-3V13a3,3,0,0,1,3-3h8a1,1,0,0,1,0,2H6a1,1,0,0,0-1,1v7a1,1,0,0,0,1,1h8a1,1,0,0,1,0,2Z",
      );

      const path2 = document.createElementNS(svgNS, "path");
      path2.setAttribute("fill", "#ffffffff");
      path2.setAttribute(
        "d",
        "M28,23H20a3,3,0,0,1-3-3V13a3,3,0,0,1,3-3h8a1,1,0,0,1,0,2H20a1,1,0,0,0-1,1v7a1,1,0,0,0,1,1h8a1,1,0,0,1,0,2Z",
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
      this.addToPlyrControlsBar(subtitlesBtn, {
        before: '[data-plyr="fullscreen"]',
      });
    }
  }

  // Utility function to add elements to the Plyr controls bar
  addToPlyrControlsBar(element, options = {}) {
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
    // Use unified overlay manager
    const overlay = this.uiController?.overlay || overlayManager;
    overlay.show("Loading subtitles...");

    const video = this.videoElement;
    if (video) {
      video.pause();
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
      // Hide overlay after switching to "none"
      overlay.hide();
      if (video && video.paused) video.play();
      return;
    }

    // Parse and validate track index
    var trackIndex = parseInt(trackValue, 10);
    if (isNaN(trackIndex) || trackIndex >= this.availableTracks.length) {
      // Hide overlay if invalid track
      overlay.hide();
      if (video && video.paused) video.play();
      return;
    }

    this.currentTrack = trackIndex;
    this.userSelectedTrack = trackIndex;
    this.updateSelectorDisplay();

    var subtitlesUrl = `/subtitles?url=${encodeURIComponent(
      this.magnetUrl,
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
      // Hide overlay after loading
      overlay.hide();
      if (video && video.paused) video.play();
    } catch (error) {
      if (CONFIG.DEBUG_MODE)
        console.error("Failed to load subtitle track:", error);
      // Hide overlay on error
      overlay.hide();
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
          console.log("SubtitlesOctopus is ready!");
          this.octopusReady = true; // Mark Octopus as ready
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
      if (window.player && window.player.ui) {
        window.player.ui.showError(
          "Subtitle engine failed to load. Video will play without subtitles.",
        );
      }
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
      this.octopusReady = false; // Reset readiness flag
    }
    this.octopusReady = false; // Ensure flag is reset even if octopus was already null
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
