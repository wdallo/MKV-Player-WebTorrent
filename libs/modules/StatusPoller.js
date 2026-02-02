/**
 * Status Poller Module
 * Handles torrent status polling
 */

import { PLAYER_CONFIG } from "../../configs/all.config.js";
import { ChromeResourceManager } from "./ChromeResourceManager.js";

export class StatusPoller {
  constructor(magnetUrl) {
    this.magnetUrl = magnetUrl;
    this.isActive = false;
    this.noPeersSince = null;
  }

  async start(onStatusUpdate) {
    this.isActive = true;
    let memoryCheckCounter = 0;

    while (this.isActive) {
      if (memoryCheckCounter++ % 10 === 0) {
        if (ChromeResourceManager.monitorMemory()) {
          await this.delay(2000);
        }
      }

      try {
        const response = await fetch(
          `/status?url=${encodeURIComponent(this.magnetUrl)}`,
        );

        if (response.ok) {
          const data = await response.json();
          this.updateNoPeersTracking(data);
          onStatusUpdate(data, null);
        } else {
          onStatusUpdate(null, `HTTP Error: ${response.status}`);
        }
      } catch (error) {
        console.error("Status fetch error:", error);
        onStatusUpdate(null, "Error fetching torrent status.");
      }

      try {
        await this.delay(PLAYER_CONFIG.STATUS_POLL_INTERVAL);
      } catch (delayError) {
        console.error("Delay error in status poller:", delayError);
        break;
      }
    }
  }

  stop() {
    this.isActive = false;
  }

  updateNoPeersTracking(data) {
    if (data.status === "no peers") {
      if (!this.noPeersSince) {
        this.noPeersSince = Date.now();
      }
      data.noPeersSince = this.noPeersSince;
    } else {
      this.noPeersSince = null;
      data.noPeersSince = null;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
