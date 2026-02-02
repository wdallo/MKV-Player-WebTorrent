/**
 * Fullscreen Controller Module
 * Handles fullscreen mode overlay management
 */

export class FullscreenController {
  constructor() {
    this.watermark = document.querySelector(".video-watermark");
    this.resumeModule = document.getElementById("resume-module");
    this.subtitleSelector = document.getElementById(
      "subtitle-selector-container",
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
      "subtitle-selector-container",
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
