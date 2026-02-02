/**
 * UI Controller Module
 * Handles all DOM manipulations and user interface
 */

import { PLAYER_CONFIG } from "../../configs/all.config.js";
import { ChromeResourceManager } from "./ChromeResourceManager.js";
import { MEMORY, UI } from "./constants.js";
import { OverlayManager } from "./OverlayManager.js";

export class UIController {
  constructor() {
    try {
      const playerElement = document.getElementById("player");
      if (playerElement) {
        ChromeResourceManager.optimizeVideo(playerElement);
      }

      this.elements = {
        progressBar: this.safeGetElement("progress-bar"),
        statusDetails: this.safeGetElement("status-details"),
        loading: this.safeGetElement("loading"),
        error: this.safeGetElement("error"),
        statusMsg: this.safeGetElement("status-msg"),
        retryBtn: this.safeGetElement("retry-btn"),
        videoContainer: this.safeGetElement("video-container"),
        video: this.safeGetElement("player"),
        resumeBtn: this.safeGetElement("resume-btn"),
        restartBtn: this.safeGetElement("restart-btn"),
        resumeModule: this.safeGetElement("resume-module-inner"),
      };

      // Initialize unified overlay manager
      this.overlay = new OverlayManager();
      this.overlay.initialize(".video-container-tag");

      this._domCache = new Map();
      this._lastCacheTime = 0;
      this._debounceTimers = new Map();

      this.bindEvents();
    } catch (error) {
      console.error("[UI] Error initializing UIController:", error);
      this.elements = {};
      // Ensure overlay is still initialized even if error occurs
      if (!this.overlay) {
        this.overlay = new OverlayManager();
        this.overlay.initialize(".video-container-tag");
      }
    }
  }

  safeGetElement(id) {
    try {
      return document.getElementById(id);
    } catch (error) {
      console.warn(`[UI] Failed to get element with id: ${id}`, error);
      return null;
    }
  }

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

  _getCachedElement(selector) {
    const now = Date.now();
    const cacheKey = selector;
    const cached = this._domCache.get(cacheKey);

    if (cached && now - this._lastCacheTime < PLAYER_CONFIG.DOM_CACHE_TIMEOUT) {
      return cached;
    }

    const element = document.querySelector(selector);
    this._domCache.set(cacheKey, element);
    this._lastCacheTime = now;
    return element;
  }

  _debounce(key, fn, delay = PLAYER_CONFIG.DEBOUNCE_DELAY) {
    const existing = this._debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      fn();
      this._debounceTimers.delete(key);
    }, delay);

    this._debounceTimers.set(key, timer);
  }

  updateStatusBar(data) {
    ChromeResourceManager.monitorMemory();

    this._debounce(
      "statusUpdate",
      () => {
        if (!data) {
          if (this.elements.progressBar)
            this.elements.progressBar.style.width = "0%";
          if (this.elements.statusDetails)
            this.elements.statusDetails.textContent = "\u00A0";
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

        if (data.status === "done") {
          if (this.elements.progressBar.parentElement)
            this.elements.progressBar.parentElement.style.display = "none";
          this.elements.statusDetails.style.display = "none";
        } else {
          if (this.elements.progressBar.parentElement)
            this.elements.progressBar.parentElement.style.display = "";
          this.elements.statusDetails.style.display = "";
        }
      },
      UI.STATUS_UPDATE_DEBOUNCE,
    );
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

    if (
      data.status === "no peers" &&
      data.noPeersSince &&
      Date.now() - data.noPeersSince > PLAYER_CONFIG.STALL_TIMEOUT
    ) {
      message += " No seeds found or torrent stalled. Try another torrent.";
    }

    return message;
  }

  showStep(message) {
    // Use unified overlay instead of step debug element
    this.overlay.show(message);

    // Still update stepDebug for debugging if it exists
    if (this.elements.stepDebug) {
      this.elements.stepDebug.textContent = message;
      // Keep it hidden since we're using overlay now
      this.elements.stepDebug.style.display = "none";
    }
  }

  hideStep() {
    // hideStep no longer hides overlay - overlay is managed by initialize()
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

  // Unified overlay methods using OverlayManager
  showOverlay(message = "Loading...") {
    this.overlay.show(message);
  }

  hideOverlay() {
    this.overlay.hide();
  }

  updateOverlayMessage(message) {
    this.overlay.updateMessage(message);
  }

  showOverlayError(message) {
    this.overlay.showError(message);
  }

  // Legacy methods for backwards compatibility
  showPlyrLoadingOverlay() {
    this.overlay.show();
  }

  hidePlyrLoadingOverlay() {
    this.overlay.hide();
  }

  updatePlyrLoadingText(text) {
    // Use show() to ensure overlay is visible when updating text
    this.overlay.show(text);
  }

  hideLoading() {
    this.elements.loading.style.display = "none";
  }

  setStatusMessage(message) {
    this.elements.statusMsg.textContent = message;
  }

  showResumeButton() {
    // Hide overlay when showing resume module to prevent conflicts
    if (this.overlay) {
      this.overlay.hide();
    }

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

  createContextMenu() {
    this.removeContextMenu();

    const contextMenu = document.createElement("div");
    contextMenu.id = "video-context-menu";
    contextMenu.className = "video-context-menu";

    const header = document.createElement("div");
    header.className = "context-menu-header";
    const title = document.createElement("span");
    title.className = "context-menu-title";
    title.textContent = "Video Status";
    header.appendChild(title);

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

    const content = document.createElement("div");
    content.className = "context-menu-content";

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

    this.updateContextMenuStatus();

    const rect = contextMenu.getBoundingClientRect();
    let maxX, maxY, containerWidth, containerHeight;

    if (isFullscreen) {
      const fsElement = document.fullscreenElement;
      containerWidth = fsElement.clientWidth;
      containerHeight = fsElement.clientHeight;

      const fsRect = fsElement.getBoundingClientRect();
      x = x - fsRect.left;
      y = y - fsRect.top;
    } else {
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

    const hideMenu = (e) => {
      if (!contextMenu.contains(e.target)) {
        this.removeContextMenu();
        document.removeEventListener("click", hideMenu);
        document.removeEventListener("mousedown", hideMenu);
      }
    };

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
      "context-subtitle-progress",
    );
    const downloadProgressEl = document.getElementById(
      "context-download-progress",
    );

    if (
      !videoBufferEl ||
      !subtitleStatusEl ||
      !subtitleProgressEl ||
      !downloadProgressEl
    )
      return;

    // Video buffer status
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

    // Subtitle status
    if (window.player && window.player.subtitlesManager) {
      const subtitles = window.player.subtitlesManager;
      const hasInitializedSubtitles = subtitles.initialized;
      const hasActiveTrack =
        subtitles.currentTrack !== null && subtitles.currentTrack !== undefined;
      const hasSubtitleUrl = subtitles.subtitlesUrl;
      const hasAvailableTracks =
        subtitles.availableTracks && subtitles.availableTracks.length > 0;
      const hasOctopus = subtitles.octopus;

      if (hasInitializedSubtitles && hasActiveTrack) {
        const currentTrack = subtitles.availableTracks[subtitles.currentTrack];
        const language = currentTrack
          ? currentTrack.language ||
            currentTrack.name ||
            `Track ${subtitles.currentTrack + 1}`
          : "Unknown";
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

    // Subtitle progress
    if (window.player && window.player.subtitlesManager) {
      const subtitles = window.player.subtitlesManager;
      if (subtitles.initialized && subtitles.octopus) {
        const contentLength = subtitles.lastSubtitleContent
          ? subtitles.lastSubtitleContent.length
          : 0;
        const eventCount = subtitles.lastEventCount || 0;
        const contentSizeKB = (contentLength / MEMORY.KB).toFixed(1);
        subtitleProgressEl.textContent = "";
        const eventsSpan = document.createElement("span");
        eventsSpan.style.color = "#4caf50";
        eventsSpan.textContent = `${eventCount} events`;
        const sizeSpan = document.createElement("span");
        sizeSpan.style.color = "#81c784";
        sizeSpan.textContent = ` (${contentSizeKB} KB)`;
        subtitleProgressEl.appendChild(eventsSpan);
        subtitleProgressEl.appendChild(sizeSpan);
      } else if (
        subtitles.availableTracks &&
        subtitles.availableTracks.length > 0
      ) {
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

    // Download progress
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

  setupVideoContextMenu() {
    if (!this.elements.video) {
      if (PLAYER_CONFIG.DEBUG_MODE)
        console.warn("Video element not found for context menu setup");
      return;
    }

    this.elements.video.removeEventListener(
      "contextmenu",
      this.videoContextHandler,
    );

    this.videoContextHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e.clientX, e.clientY);
    };

    this.elements.video.addEventListener(
      "contextmenu",
      this.videoContextHandler,
    );

    if (this.elements.videoContainer) {
      this.elements.videoContainer.removeEventListener(
        "contextmenu",
        this.containerContextHandler,
      );

      this.containerContextHandler = (e) => {
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
        this.containerContextHandler,
      );
    }

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

  cleanup() {
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    this._domCache.clear();

    ChromeResourceManager.forceGarbageCollection();

    this.removeContextMenu();

    if (this.videoContextHandler && this.elements.video) {
      this.elements.video.removeEventListener(
        "contextmenu",
        this.videoContextHandler,
      );
    }
  }
}
