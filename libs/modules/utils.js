/**
 * Utility Functions Module
 * Emergency handlers, circuit breaker, and watchdog
 */

import { CIRCUIT_BREAKER, WATCHDOG } from "./constants.js";

// Circuit breaker to prevent infinite loops
let globalErrorCount = 0;
let lastErrorTime = 0;

export function checkCircuitBreaker() {
  const now = Date.now();
  if (now - lastErrorTime > CIRCUIT_BREAKER.RESET_INTERVAL) {
    globalErrorCount = 0; // Reset counter every minute
  }
  lastErrorTime = now;

  if (++globalErrorCount > CIRCUIT_BREAKER.MAX_ERRORS_PER_MINUTE) {
    console.error("[CIRCUIT BREAKER] Too many errors, forcing page reload");
    setTimeout(() => window.location.reload(), CIRCUIT_BREAKER.RELOAD_DELAY);
    return true;
  }
  return false;
}

// Watchdog timer to detect page freeze
let watchdogTimer;
let lastHeartbeat = Date.now();

export function startWatchdog() {
  watchdogTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastHeartbeat > WATCHDOG.FREEZE_THRESHOLD) {
      console.error("[WATCHDOG] Page appears frozen, reloading...");
      window.location.reload();
    }
  }, WATCHDOG.CHECK_INTERVAL);
}

export function heartbeat() {
  lastHeartbeat = Date.now();
}

// Initialize emergency handlers
export function initializeEmergencyHandlers() {
  // Emergency crash prevention - catch everything
  window.addEventListener("error", (e) => {
    console.error("EMERGENCY: Critical error caught:", e.error);
    if (checkCircuitBreaker()) return false;
    e.preventDefault();
    return false;
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("EMERGENCY: Critical promise rejection:", e.reason);
    if (checkCircuitBreaker()) return false;
    e.preventDefault();
    return false;
  });

  // Start watchdog
  startWatchdog();
  setInterval(heartbeat, WATCHDOG.HEARTBEAT_INTERVAL);
}

/**
 * Utility function to add elements to the Plyr controls bar
 */
export function addToPlyrControlsBar(element, options = {}) {
  const controlsBar = document.querySelector(".plyr__controls");
  if (!controlsBar) {
    console.warn("[PLYR] Controls bar not found");
    return false;
  }

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

  if (options.prepend) {
    controlsBar.insertBefore(element, controlsBar.firstChild);
    return true;
  }

  controlsBar.appendChild(element);
  return true;
}

/**
 * Utility function to clean localStorage for any magnet URL
 */
export function cleanLocalStorageForMagnet(magnetUrl) {
  if (!magnetUrl) {
    console.warn("[CLEANUP] No magnet URL provided");
    return;
  }

  try {
    console.log("[CLEANUP] Cleaning localStorage for magnet:", magnetUrl);

    const removedKeys = [];
    const magnetHash = magnetUrl.split("btih:")[1]?.split("&")[0];
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes(magnetUrl) || (magnetHash && key.includes(magnetHash)))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      removedKeys.push(key);
    });

    console.log("[CLEANUP] Removed keys:", removedKeys);
    return { success: true, removedKeys };
  } catch (err) {
    console.error("[CLEANUP] Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Global cleanup notification system
 */
export function notifyMagnetDeleted(magnetUrl) {
  if (!magnetUrl) {
    console.warn("[NOTIFY] No magnet URL provided");
    return;
  }

  console.log("Received notification that magnet was deleted:", magnetUrl);

  const result = cleanLocalStorageForMagnet(magnetUrl);

  if (window.player && window.player.magnetUrl === magnetUrl) {
    window.player.ui.showError(
      "Files were deleted. Please reload with a new torrent.",
    );
    window.player.statusPoller.stop();
  }

  return result;
}
