/**
 * Resource Loader Module
 * Handles loading of video and subtitle resources
 */

import { PLAYER_CONFIG } from "../../configs/all.config.js";
import { RETRY, HTTP_STATUS } from "./constants.js";

export class ResourceLoader {
  async pollUntilReady(url, isText = false) {
    for (let i = 0; i < PLAYER_CONFIG.RESOURCE_TIMEOUT; i++) {
      if (window.player && window.player.ui) {
        window.player.ui.updatePlyrLoadingText(
          `Waiting for resource... (${i + 1}/${PLAYER_CONFIG.RESOURCE_TIMEOUT})`,
        );
      }

      try {
        const response = await fetch(url);

        if (response.ok && response.status === HTTP_STATUS.OK) {
          if (isText) {
            const text = await response.text();
            if (text && text.length > 0 && text !== "NOT_READY") {
              return text;
            } else if (text === "NOT_READY") {
              console.log(`[RESOURCE] Resource not ready yet: ${url}`);
            }
          } else {
            // Check if response is NOT_READY text
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("text")) {
              const text = await response.text();
              if (text === "NOT_READY") {
                console.log(`[RESOURCE] Video not ready yet: ${url}`);
              } else {
                console.warn(`[RESOURCE] Unexpected text response: ${text}`);
              }
            } else {
              // Video is ready, return the URL
              return url;
            }
          }
        } else if (
          response.status === 202 ||
          response.headers.get("x-status") === HTTP_STATUS.NOT_READY
        ) {
          console.log(`[RESOURCE] Not ready yet: ${url}`);
        } else {
          console.warn(
            `[RESOURCE] Unexpected status ${response.status} for ${url}`,
          );
        }
      } catch (error) {
        console.warn(`[RESOURCE] Fetch error for ${url}:`, error);
      }

      await this.delay(RETRY.POLL_DELAY);
    }

    console.error(`[RESOURCE] Timeout waiting for ${url}`);
    throw new Error(`Timeout waiting for ${url}`);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
