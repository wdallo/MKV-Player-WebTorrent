/**
 * OverlayManager - Unified overlay management system
 * Handles all loading states, messages, and overlay visibility
 */

import { UI } from "./constants.js";

export class OverlayManager {
  constructor() {
    this.overlay = null;
    this.messageElement = null;
    this.spinnerElement = null;
    this.initialized = false;
  }

  /**
   * Initialize the overlay manager
   * @param {HTMLElement|string} container - Container element or selector
   */
  initialize(container = ".video-container-tag") {
    if (this.initialized) {
      return;
    }

    // Get the #overlay element from DOM
    this.overlay = document.getElementById("overlay");

    if (!this.overlay) {
      throw new Error("OverlayManager: #overlay element not found in DOM!");
    }

    // Clear any existing content
    this.overlay.innerHTML = "";

    // Apply our styles
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(17, 17, 17, 0.95);
      z-index: ${UI.LOADING_OVERLAY_Z_INDEX};
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    `;

    // Create and append spinner
    this.spinnerElement = this.createSpinner();
    this.overlay.appendChild(this.spinnerElement);

    // Create and append message
    this.messageElement = this.createMessage();
    this.overlay.appendChild(this.messageElement);

    // Add spinner animation CSS if not already present
    if (!document.getElementById("overlay-spinner-animation")) {
      const style = document.createElement("style");
      style.id = "overlay-spinner-animation";
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    this.initialized = true;
  }

  /**
   * Create spinner element
   */
  createSpinner() {
    const spinner = document.createElement("div");
    spinner.className = "overlay-spinner";
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    `;
    return spinner;
  }

  /**
   * Create message element
   */
  createMessage() {
    const message = document.createElement("div");
    message.className = "overlay-message";
    message.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #fff;
      text-align: center;
    `;
    message.textContent = "Loading...";
    return message;
  }

  /**
   * Create the unified overlay element
   */
  createOverlay() {
    throw new Error(
      "OverlayManager.createOverlay() should not be called. Use #overlay element from DOM.",
    );
  }

  /**
   * Show the overlay with a message
   * @param {string} message - Message to display
   */
  show(message = "Loading...") {
    console.log("[OVERLAY] show() called with message:", message);

    if (!this.initialized) {
      console.log("[OVERLAY] Not initialized, initializing now...");
      this.initialize();
    }

    // Double-check overlay is in DOM
    if (this.overlay && !document.body.contains(this.overlay)) {
      console.warn("[OVERLAY] Overlay not in DOM, re-appending...");
      const container = document.querySelector(".video-container-tag");
      if (container) {
        container.appendChild(this.overlay);
        console.log("[OVERLAY] Overlay re-appended to container");
      } else {
        console.error("[OVERLAY] Container not found for re-appending!");
      }
    }

    if (this.overlay) {
      this.overlay.style.display = "flex";
      console.log("[OVERLAY] Display set to flex");
      console.log("[OVERLAY] Current overlay styles:", {
        display: this.overlay.style.display,
        position: this.overlay.style.position,
        zIndex: this.overlay.style.zIndex,
        inDOM: document.body.contains(this.overlay),
      });
    } else {
      console.error("[OVERLAY] No overlay element!");
    }

    if (this.messageElement) {
      this.messageElement.textContent = message;
      console.log("[OVERLAY] Message updated to:", message);
    } else if (this.overlay) {
      // Try to find it again
      const msg = this.overlay.querySelector(".overlay-message");
      console.log("[OVERLAY] Tried to find messageElement, found:", !!msg);
      if (msg) {
        this.messageElement = msg;
        this.messageElement.textContent = message;
      }
    }
  }

  /**
   * Update the message without showing/hiding
   * @param {string} message - New message to display
   */
  updateMessage(message) {
    if (this.messageElement) {
      this.messageElement.textContent = message;
    }
  }

  /**
   * Hide the overlay
   */
  hide() {
    console.log("[OVERLAY] hide() called");
    if (this.overlay) {
      this.overlay.style.display = "none";
      console.log("[OVERLAY] Display set to none");
    }
  }

  /**
   * Check if overlay is currently visible
   */
  isVisible() {
    return this.overlay && this.overlay.style.display === "flex";
  }

  /**
   * Show error message in overlay (red spinner)
   * @param {string} message - Error message
   */
  showError(message) {
    this.show(message);
    if (this.spinnerElement) {
      this.spinnerElement.style.borderTopColor = "#f44336";
    }
    if (this.messageElement) {
      this.messageElement.style.color = "#f44336";
    }
  }

  /**
   * Reset overlay styling (remove error state)
   */
  resetStyle() {
    if (this.spinnerElement) {
      this.spinnerElement.style.borderTopColor = "#fff";
    }
    if (this.messageElement) {
      this.messageElement.style.color = "#fff";
    }
  }

  /**
   * Dispose and clean up overlay
   */
  dispose() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.messageElement = null;
    this.spinnerElement = null;
    this.initialized = false;
  }

  /**
   * Position overlay in fullscreen mode
   * @param {boolean} isFullscreen - Whether in fullscreen mode
   */
  handleFullscreen(isFullscreen) {
    if (!this.overlay) return;

    if (isFullscreen) {
      this.overlay.style.position = "fixed";
      this.overlay.style.zIndex = "999999999";
    } else {
      this.overlay.style.position = "absolute";
      this.overlay.style.zIndex = UI.LOADING_OVERLAY_Z_INDEX;
    }
  }
}

// Create singleton instance
export const overlayManager = new OverlayManager();
