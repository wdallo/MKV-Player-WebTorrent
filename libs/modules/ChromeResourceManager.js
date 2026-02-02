/**
 * Chrome Resource Manager Module
 * Handles memory monitoring and optimization
 */

import { MEMORY } from "./constants.js";

export class ChromeResourceManager {
  static monitorMemory() {
    try {
      if (performance && performance.memory) {
        const memoryInfo = performance.memory;
        const usedMemory = memoryInfo.usedJSHeapSize;
        const totalMemory = memoryInfo.jsHeapSizeLimit;
        const usageRatio = usedMemory / totalMemory;

        if (usageRatio > MEMORY.HIGH_USAGE_THRESHOLD) {
          console.warn(
            `[MEMORY] High usage detected: ${(usageRatio * 100).toFixed(1)}% (${(
              usedMemory / MEMORY.MB
            ).toFixed(1)} MB / ${(totalMemory / MEMORY.MB).toFixed(1)} MB)`,
          );

          this.forceGarbageCollection();
          return true;
        }
      }
    } catch (error) {
      console.warn("[MEMORY] Error monitoring:", error);
    }
    return false;
  }

  static forceGarbageCollection() {
    try {
      if (window.gc) {
        window.gc();
      }

      try {
        if (document.querySelectorAll) {
          const nodes = document.querySelectorAll("*");
          nodes.length;
        }
      } catch (domError) {
        console.warn("[MEMORY] DOM cache clear failed:", domError);
      }
    } catch (error) {
      console.warn("[MEMORY] Error forcing garbage collection:", error);
    }
  }

  static optimizeVideo(videoElement) {
    try {
      if (!videoElement) return;

      if (this.monitorMemory()) {
        if (videoElement.playbackRate) {
          videoElement.playbackRate = 1.0;
        }
      }

      videoElement.preload = "metadata";

      if (videoElement.disablePictureInPicture !== undefined) {
        videoElement.disablePictureInPicture = true;
      }
    } catch (error) {
      console.warn("Error optimizing video:", error);
    }
  }
}
