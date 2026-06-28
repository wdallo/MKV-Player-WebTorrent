import { VideoPlayerController } from "./player.js";

// Initialize the application with error handling
document.addEventListener("DOMContentLoaded", async () => {
  // Apply Electron fullscreen layout if running inside Electron environment
  if (window.electronAPI) {
    document.body.classList.add("electron-app");
    const electronStyle = document.createElement("link");
    electronStyle.rel = "stylesheet";
    electronStyle.href = "/libs/styles/electron-min.css";
    document.head.appendChild(electronStyle);
  }

  try {
    // Read the magnet parameter from the hidden data attribute on the script tag
    const scriptTag = document.getElementById("player-core-loader-script");
    const magnetUrl = scriptTag
      ? decodeURIComponent(scriptTag.getAttribute("data-magnet"))
      : "";

    if (!magnetUrl) {
      console.error("No magnet URL provided to the player loader.");
      return;
    }

    console.log("Initializing player with magnet:", magnetUrl);

    // Initialize player - it will use its own overlay manager
    const player = new VideoPlayerController(magnetUrl);
    window.player = player;
    await player.initialize();
  } catch (error) {
    console.error("❌ Failed to initialize player:", error);
  }
});

// Fallback error handler for ES6 module loading issues
window.addEventListener("error", function (e) {
  if (e.message && e.message.includes("module")) {
    console.error("ES6 Module Loading Error:", e);
    const overlay = document.getElementById("plyr-loading-overlay");
    if (overlay) {
      // Clear existing content safely
      overlay.textContent = "";

      // Create error container
      const errorContainer = document.createElement("div");
      errorContainer.style.cssText =
        "text-align: center; color: #fff; padding: 20px;";

      // Create icon
      const iconDiv = document.createElement("div");
      iconDiv.textContent = "⚠️";
      iconDiv.style.cssText = "font-size: 3em; margin-bottom: 10px;";

      // Create title
      const titleDiv = document.createElement("div");
      titleDiv.textContent = "Module Loading Error";
      titleDiv.style.cssText = "font-size: 1.2em; margin-bottom: 10px;";

      // Create description
      const descDiv = document.createElement("div");
      descDiv.textContent =
        "Please refresh the page or try a different browser that supports ES6 modules.";
      descDiv.style.cssText = "font-size: 0.9em; opacity: 0.8;";

      // Assemble the error display
      errorContainer.appendChild(iconDiv);
      errorContainer.appendChild(titleDiv);
      errorContainer.appendChild(descDiv);
      overlay.appendChild(errorContainer);
    }
  }
});
