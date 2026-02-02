/**
 * MKV Video Player - Main Entry Point
 * Modular architecture with backward compatibility
 */

// Import all modules
import { VideoPlayerController } from "./modules/VideoPlayerController.js";
import { SubtitlesManager } from "./modules/SubtitlesManager.js";
import { FullscreenController } from "./modules/FullscreenController.js";
import { AudioManager } from "./modules/AudioManager.js";
import { UIController } from "./modules/UIController.js";
import { RetryController } from "./modules/RetryController.js";
import { StatusPoller } from "./modules/StatusPoller.js";
import { ResourceLoader } from "./modules/ResourceLoader.js";
import { ChromeResourceManager } from "./modules/ChromeResourceManager.js";
import {
  initializeEmergencyHandlers,
  cleanLocalStorageForMagnet,
  notifyMagnetDeleted,
} from "./modules/utils.js";
import { PLAYER_CONFIG } from "../configs/all.config.js";

const CONFIG = PLAYER_CONFIG;

// Make CONFIG available globally for UI access
window.CONFIG = PLAYER_CONFIG;

// Initialize emergency handlers (circuit breaker, watchdog, etc.)
initializeEmergencyHandlers();

/**
 * Utility function to clean localStorage for any magnet URL
 * Can be called from browser console: cleanLocalStorageForMagnet('magnet:?xt=...')
 */
window.cleanLocalStorageForMagnet = cleanLocalStorageForMagnet;

/**
 * Global cleanup notification system
 * Allows server or other sources to trigger localStorage cleanup for all users
 */
window.notifyMagnetDeleted = notifyMagnetDeleted;

// Setup outside click handler for subtitle selector
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

// Export all classes for ES6 module usage
export {
  VideoPlayerController,
  UIController,
  SubtitlesManager,
  AudioManager,
  RetryController,
  StatusPoller,
  ResourceLoader,
  FullscreenController,
  ChromeResourceManager,
};
