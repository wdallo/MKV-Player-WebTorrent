/**
 * Retry Controller Module
 * Handles retry logic with exponential backoff
 */

import { PLAYER_CONFIG } from "../../configs/all.config.js";
import { RETRY } from "./constants.js";

export class RetryController {
  constructor(maxRetries = PLAYER_CONFIG.MAX_RETRIES) {
    this.maxRetries = maxRetries;
    this.retryCount = 0;
    this.retryInterval = null;
  }

  reset() {
    this.retryCount = 0;
    this.clearContinuousRetry();
  }

  getRetryDelay() {
    return Math.min(
      PLAYER_CONFIG.BASE_RETRY_DELAY + this.retryCount * RETRY.DELAY_INCREMENT,
      PLAYER_CONFIG.MAX_RETRY_DELAY,
    );
  }

  shouldRetry() {
    return this.retryCount < this.maxRetries;
  }

  async executeRetry(retryFn, onStep) {
    if (this.shouldRetry()) {
      this.retryCount++;
      const delay = this.getRetryDelay();

      onStep?.(
        `Retrying video load, attempt ${this.retryCount}/${
          this.maxRetries
        } (waiting ${delay / 1000}s)`,
      );

      await this.delay(delay);
      return retryFn();
    } else {
      onStep?.("Max retry attempts reached. Switching to continuous retry...");
      this.startContinuousRetry(retryFn, onStep);
    }
  }

  startContinuousRetry(retryFn, onStep) {
    this.retryInterval = setInterval(() => {
      onStep?.("Continuous retry: Reloading video...");
      retryFn();
    }, PLAYER_CONFIG.CONTINUOUS_RETRY_INTERVAL);
  }

  clearContinuousRetry() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
