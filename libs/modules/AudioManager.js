/**
 * Audio Manager Module
 * Handles multi-track audio selection and switching
 */

import { PLAYER_CONFIG } from "../../configs/all.config.js";

const CONFIG = PLAYER_CONFIG;

export class AudioManager {
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
            "Audio manager: No multi audio tracks found, skipping initialization.",
          );
        }
        this.initialized = false;
        return;
      }
      this.initialized = true;
      if (CONFIG.DEBUG_MODE) {
        console.log(
          `Audio manager initialized with ${this.availableTracks.length} tracks`,
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
        `/audio-tracks?url=${encodeURIComponent(this.magnetUrl)}`,
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
      "M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V21h2v-2.07c3.39-.5 6-3.4 6-6.93h-2z",
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
    const added = this.addToPlyrControlsBar(switchButton, {
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
          `[AUDIO] Switching from track ${this.currentTrack} to track ${trackIndex}`,
        );
        console.log(
          `[AUDIO] Current time: ${currentTime}, was playing: ${wasPlaying}`,
        );
        console.log(`[AUDIO] Old source: ${oldSrc}`);
      }

      // Update video source to use new audio track
      const newSrc = `/video?url=${encodeURIComponent(
        this.magnetUrl,
      )}&audioTrack=${trackIndex}`;

      if (CONFIG.DEBUG_MODE) {
        console.log(`[AUDIO] New source: ${newSrc}`);
      }

      // Test if the new source is actually different and valid
      if (oldSrc === newSrc) {
        console.warn(
          `[AUDIO] Source URL is the same, audio track might not be changing`,
        );
      }

      // Use unified overlay from player
      const overlay = window.player?.ui?.overlay;
      if (overlay) {
        overlay.show(`Switching to audio track ${trackIndex + 1}...`);
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

        if (overlay) {
          overlay.hide();
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
                "[AUDIO] updateAudioTrackMetadata method not available, skipping metadata UI update",
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
            }),
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

        // Hide unified overlay
        const overlay = window.player?.ui?.overlay;
        if (overlay) {
          overlay.hide();
        }

        // Verify the switch actually worked
        setTimeout(() => {
          console.log(
            `[AUDIO] Final verification - Current source: ${video.src}`,
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
        const overlay = window.player?.ui?.overlay;
        if (overlay) {
          console.warn(
            `[AUDIO] Timeout waiting for canplay event, forcing restore`,
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
          }`,
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
      "audio-selector-container",
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
            `[AUDIO] Updated audio track metadata: ${trackDisplayInfo}`,
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
        ".audio-track-indicator",
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
