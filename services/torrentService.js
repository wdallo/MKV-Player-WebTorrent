/**
 * Refactored Torrent Service with class-based architecture
 * Handles WebTorrent operations with improved error handling and performance
 */

import WebTorrent from "webtorrent";
import { EventEmitter } from "events";
import { TORRENT_CONFIG, FS_CONFIG } from "../configs/environment.config.js";
import { createLogger } from "../utils/logger.js";
import {
  ensureDirectory,
  safeDeleteFile,
  isVideoFile,
} from "../utils/fileUtils.js";
import { isValidMagnet } from "../utils/validator.js";

const logger = createLogger("TORRENT_SERVICE");

/**
 * Torrent state class to encapsulate torrent data
 */
class TorrentState {
  constructor(magnet) {
    this.magnet = magnet;
    this.torrent = null;
    this.videoFile = null;
    this.videoMime = "video/mp4";
    this.lastAccess = Date.now();
    this.createdAt = Date.now();
    this.accessCount = 0;
    this.deleteTimer = null;
    this.fileDeleted = false;
    this.deletedAt = null;
    this.error = null;
  }

  /**
   * Update last access time and increment counter
   */
  touch() {
    this.lastAccess = Date.now();
    this.accessCount++;
  }

  /**
   * Check if torrent is inactive
   */
  isInactive(threshold = TORRENT_CONFIG.INACTIVE_THRESHOLD) {
    return Date.now() - this.lastAccess > threshold;
  }

  /**
   * Check if torrent is ready for streaming
   */
  isReady(minBytes = TORRENT_CONFIG.MIN_READY_BYTES) {
    // Basic checks
    if (!this.videoFile) return false;

    // If enough data downloaded, consider ready
    if (this.videoFile.downloaded >= minBytes) {
      return true;
    }

    // Otherwise check if first piece is downloaded (for starting from beginning)
    return (
      this.videoFile.downloaded >= minBytes && this.isFirstPieceDownloaded()
    );
  }

  /**
   * Check if first piece is downloaded
   */
  isFirstPieceDownloaded() {
    if (!this.videoFile?._torrent?.bitfield) {
      return false;
    }
    const firstPiece = this.videoFile._startPiece || 0;
    return this.videoFile._torrent.bitfield.get(firstPiece);
  }

  /**
   * Clear auto-delete timer
   */
  clearTimer() {
    if (this.deleteTimer) {
      clearTimeout(this.deleteTimer);
      this.deleteTimer = null;
    }
  }
}

/**
 * LRU Cache for torrent states
 */
class TorrentCache {
  constructor(maxSize = TORRENT_CONFIG.CACHE_MAX_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const item = this.cache.get(key);

    // Check TTL
    if (Date.now() - item.cachedAt > TORRENT_CONFIG.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.data;
  }

  set(key, data) {
    // Remove if exists to update position
    this.cache.delete(key);

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * Main Torrent Service Class
 */
class TorrentService extends EventEmitter {
  constructor() {
    super();

    this.client = null;
    this.torrents = new Map();
    this.cache = new TorrentCache();
    this.downloadDir = FS_CONFIG.DOWNLOAD_DIR;
    this.isInitialized = false;
    this.monitoringInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * Initialize the torrent service
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("Torrent service already initialized");
      return;
    }

    try {
      // Ensure download directory exists
      await ensureDirectory(this.downloadDir);
      logger.info("Download directory ready", { path: this.downloadDir });

      // Create WebTorrent client
      this.client = new WebTorrent({
        maxConns: TORRENT_CONFIG.MAX_CONNECTIONS,
        nodeId: null,
        peerId: null,
        tracker: {
          announce: [],
          getAnnounceOpts() {
            return {
              numwant: 80,
              compact: 1,
            };
          },
        },
        dht: TORRENT_CONFIG.DHT_ENABLED,
        lsd: TORRENT_CONFIG.LSD_ENABLED,
        webSeeds: TORRENT_CONFIG.WEB_SEEDS_ENABLED,
        utp: TORRENT_CONFIG.UTP_ENABLED,
        blocklist: TORRENT_CONFIG.BLOCKLIST_ENABLED,
        downloadLimit: TORRENT_CONFIG.DOWNLOAD_LIMIT,
        uploadLimit: TORRENT_CONFIG.UPLOAD_LIMIT,
      });

      // Setup error handling
      this.client.on("error", (error) => {
        logger.error("WebTorrent client error", error);
        this.emit("client-error", error);
      });

      // Start monitoring and cleanup
      this.startMonitoring();
      this.startPeriodicCleanup();

      this.isInitialized = true;
      logger.info("Torrent service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize torrent service", error);
      throw error;
    }
  }

  /**
   * Get or add torrent
   */
  async getOrAddTorrent(magnet, seekPosition = 0) {
    // Validate magnet URI
    if (!isValidMagnet(magnet)) {
      logger.warn("Invalid magnet URI");
      return null;
    }

    // Check cache first
    const cached = this.cache.get(magnet);
    if (cached) {
      logger.debug("Torrent found in cache");
      cached.touch();
      this.optimizePieceSelection(cached.videoFile, seekPosition);
      return cached;
    }

    // Check if torrent already exists and is ready
    if (this.torrents.has(magnet)) {
      const state = this.torrents.get(magnet);

      // Only return cached state if videoFile is set
      if (state.videoFile) {
        state.touch();
        this.cache.set(magnet, state);
        this.optimizePieceSelection(state.videoFile, seekPosition);
        return state;
      } else {
        logger.debug("Torrent exists but videoFile not ready yet, waiting...", {
          magnet: magnet.substring(0, 60) + "...",
          hasTorrent: !!state.torrent,
          torrentReady: state.torrent?.ready,
        });

        // Wait for the torrent to be ready with timeout
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const timeout = 30000; // 30 seconds timeout

          const checkReady = () => {
            if (state.videoFile) {
              logger.info("VideoFile ready after waiting", {
                waitTime: Date.now() - startTime,
              });
              resolve(state);
            } else if (state.error) {
              logger.error("State has error while waiting", {
                error: state.error.message,
              });
              reject(state.error);
            } else if (Date.now() - startTime > timeout) {
              const timeoutError = new Error("Timeout waiting for videoFile");
              logger.error("Timeout waiting for videoFile", {
                waitTime: Date.now() - startTime,
                hasTorrent: !!state.torrent,
                torrentReady: state.torrent?.ready,
              });
              reject(timeoutError);
            } else {
              // Check again in 100ms
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      }
    }

    // Check max concurrent torrents
    if (this.torrents.size >= TORRENT_CONFIG.MAX_CONCURRENT_TORRENTS) {
      logger.warn("Max concurrent torrents reached, cleaning up old torrents");
      await this.cleanupOldTorrents();
    }

    // Add new torrent
    return await this.addTorrent(magnet, seekPosition);
  }

  /**
   * Add new torrent
   */
  async addTorrent(magnet, seekPosition = 0) {
    return new Promise((resolve, reject) => {
      logger.info("Adding new torrent", {
        magnet: magnet.substring(0, 60) + "...",
      });

      try {
        // Extract info hash from magnet URL for duplicate checking
        let infoHash = null;
        try {
          const match = magnet.match(/urn:btih:([a-zA-Z0-9]+)/i);
          if (match && match[1]) {
            infoHash = match[1].toLowerCase();
          }
        } catch (e) {
          logger.warn("Failed to extract info hash from magnet", {
            magnet: magnet.substring(0, 60) + "...",
          });
        }

        // Check if torrent already exists in WebTorrent client
        // Try both magnet and info hash
        let existingTorrent =
          this.client.get(magnet) ||
          (infoHash ? this.client.get(infoHash) : null);

        // If not found, manually search through all torrents by infoHash
        if (!existingTorrent && infoHash && this.client.torrents) {
          existingTorrent = this.client.torrents.find(
            (t) => t.infoHash && t.infoHash.toLowerCase() === infoHash,
          );

          if (existingTorrent) {
            logger.info("Found existing torrent by iterating torrents array", {
              infoHash,
              torrentName: existingTorrent.name || "unknown",
            });
          }
        }

        // Create state only after checking for duplicates
        const state = new TorrentState(magnet);
        this.torrents.set(magnet, state);

        // WebTorrent.get() can return an array if multiple torrents match
        if (Array.isArray(existingTorrent)) {
          existingTorrent = existingTorrent[0];
        }

        if (existingTorrent) {
          logger.info("Torrent already exists in client, reusing it", {
            magnet: magnet.substring(0, 60) + "...",
            infoHash: existingTorrent.infoHash || "unknown",
            ready: existingTorrent.ready,
            hasFiles: !!(
              existingTorrent.files && existingTorrent.files.length > 0
            ),
          });

          // Reuse existing torrent
          state.torrent = existingTorrent;

          // Check if torrent is fully ready (has files)
          const isFullyReady =
            existingTorrent.ready &&
            existingTorrent.files &&
            existingTorrent.files.length > 0;

          if (isFullyReady) {
            this.onTorrentReady(existingTorrent, state, seekPosition);
            resolve(state);
          } else {
            logger.warn("Existing torrent not fully ready", {
              ready: existingTorrent.ready,
              hasFiles: !!existingTorrent.files,
              filesLength: existingTorrent.files?.length,
            });

            // Wait for torrent to be ready - check if event methods exist
            if (typeof existingTorrent.once === "function") {
              // Set a timeout in case ready event never fires
              const readyTimeout = setTimeout(() => {
                logger.error(
                  "Timeout waiting for existing torrent ready event",
                  {
                    infoHash,
                    ready: existingTorrent.ready,
                    hasFiles: !!existingTorrent.files,
                  },
                );
                reject(new Error("Timeout waiting for torrent ready"));
              }, 30000);

              existingTorrent.once("ready", () => {
                clearTimeout(readyTimeout);
                logger.info("Existing torrent ready event fired");
                this.onTorrentReady(existingTorrent, state, seekPosition);
                resolve(state);
              });

              // Also handle errors
              existingTorrent.once("error", (error) => {
                clearTimeout(readyTimeout);
                logger.error("Existing torrent error", error);
                state.error = error;
                this.emit("torrent-error", { magnet, error });
                reject(error);
              });

              // If torrent is already ready but files not populated yet, poll for files
              if (existingTorrent.ready) {
                logger.info(
                  "Torrent is ready but no files, polling for files...",
                );
                const pollFiles = () => {
                  if (
                    existingTorrent.files &&
                    existingTorrent.files.length > 0
                  ) {
                    clearTimeout(readyTimeout);
                    logger.info("Files populated, calling onTorrentReady");
                    this.onTorrentReady(existingTorrent, state, seekPosition);
                    resolve(state);
                  } else {
                    setTimeout(pollFiles, 100);
                  }
                };
                pollFiles();
              }
            } else {
              // Torrent object is invalid (missing event methods)
              // Remove it and add fresh torrent
              logger.warn(
                "Existing torrent is invalid, removing and re-adding",
                {
                  magnet: magnet.substring(0, 60) + "...",
                  ready: existingTorrent.ready,
                  hasFiles: !!existingTorrent.files,
                  hasOnce: typeof existingTorrent.once === "function",
                },
              );

              try {
                existingTorrent.destroy();
              } catch (destroyError) {
                logger.warn("Failed to destroy invalid torrent", destroyError);
              }

              // Set existingTorrent to null so we add a fresh one below
              existingTorrent = null;
            }
          }

          // Setup auto-delete timer if we're using the existing torrent
          if (existingTorrent) {
            this.setupAutoDelete(magnet);
            return;
          }
        }

        // Add new torrent if no valid existing torrent found
        logger.info("Adding fresh torrent to client", {
          magnet: magnet.substring(0, 60) + "...",
        });

        // Wrap client.add in try-catch to handle duplicate errors
        try {
          // Add new torrent if it doesn't exist
          state.torrent = this.client.add(
            magnet,
            {
              path: this.downloadDir,
              strategy: "sequential",
            },
            (torrent) => {
              this.onTorrentReady(torrent, state, seekPosition);
              resolve(state);
            },
          );

          // Error handling
          state.torrent.on("error", (error) => {
            logger.error("Torrent error", error);
            state.error = error;
            this.emit("torrent-error", { magnet, error });
            reject(error);
          });

          // Setup auto-delete timer
          this.setupAutoDelete(magnet);
        } catch (addError) {
          // If duplicate error, try to find the existing torrent
          if (addError.message && addError.message.includes("duplicate")) {
            logger.warn(
              "Duplicate torrent error, attempting to find existing torrent",
              {
                infoHash,
                error: addError.message,
              },
            );

            // Try to find by iterating all torrents
            const foundTorrent =
              infoHash && this.client.torrents
                ? this.client.torrents.find(
                    (t) => t.infoHash && t.infoHash.toLowerCase() === infoHash,
                  )
                : null;

            if (foundTorrent) {
              logger.info("Found duplicate torrent, reusing it", {
                infoHash,
                name: foundTorrent.name || "unknown",
              });

              state.torrent = foundTorrent;

              // Check if ready
              const isFullyReady =
                foundTorrent.ready &&
                foundTorrent.files &&
                foundTorrent.files.length > 0;

              if (isFullyReady) {
                this.onTorrentReady(foundTorrent, state, seekPosition);
                resolve(state);
              } else if (typeof foundTorrent.once === "function") {
                foundTorrent.once("ready", () => {
                  this.onTorrentReady(foundTorrent, state, seekPosition);
                  resolve(state);
                });
                foundTorrent.once("error", (error) => {
                  logger.error("Duplicate torrent error", error);
                  state.error = error;
                  reject(error);
                });
              } else {
                reject(
                  new Error(
                    "Duplicate torrent found but not ready and cannot wait",
                  ),
                );
              }

              this.setupAutoDelete(magnet);
            } else {
              // Could not find torrent, reject
              logger.error("Duplicate error but could not find torrent", {
                infoHash,
              });
              reject(addError);
            }
          } else {
            // Different error, rethrow
            throw addError;
          }
        }
      } catch (error) {
        logger.error("Failed to add torrent", {
          error: error.message,
          code: error.code,
          stack: error.stack,
          magnet: magnet.substring(0, 60) + "...",
        });
        this.torrents.delete(magnet);
        reject(error);
      }
    });
  }

  /**
   * Handle torrent ready event
   */
  onTorrentReady(torrent, state, seekPosition) {
    logger.info("onTorrentReady called", {
      torrentName: torrent?.name,
      hasTorrent: !!torrent,
      hasFiles: !!(torrent && torrent.files),
      filesCount: torrent?.files?.length,
      stateMagnet: state?.magnet?.substring(0, 60),
    });

    // Validate torrent object
    if (!torrent || !torrent.files) {
      logger.error("Invalid torrent object in onTorrentReady", {
        hasTorrent: !!torrent,
        hasFiles: !!(torrent && torrent.files),
      });
      state.error = new Error("Invalid torrent object");
      return;
    }

    logger.info("Torrent ready - finding video file", {
      name: torrent.name || "unknown",
      files: torrent.files.length,
    });

    // Find video file
    const videoFile = torrent.files.find((f) => isVideoFile(f.name));

    if (!videoFile) {
      logger.warn("No video file found in torrent");
      state.error = new Error("No video file found");
      return;
    }

    state.videoFile = videoFile;
    state.videoMime = videoFile.name.endsWith(".mkv")
      ? "video/x-matroska"
      : "video/mp4";

    logger.info("Video file set on state", {
      name: videoFile.name,
      size: videoFile.length,
      mime: state.videoMime,
      downloaded: videoFile.downloaded,
      stateMagnet: state.magnet.substring(0, 60),
    });

    // Optimize piece selection
    this.optimizePieceSelection(videoFile, seekPosition);

    // Update cache
    this.cache.set(state.magnet, state);

    logger.info("State cached, torrent fully ready", {
      magnet: state.magnet.substring(0, 60) + "...",
    });

    this.emit("torrent-ready", state);
  }

  /**
   * Optimize piece selection for streaming
   */
  optimizePieceSelection(videoFile, seekPosition = 0) {
    if (!videoFile?._torrent) {
      return;
    }

    const pieceLength = videoFile._torrent.pieceLength || 32768;
    const totalPieces = Math.floor(videoFile.length / pieceLength);
    const startPiece = Math.floor(seekPosition / pieceLength);

    // Calculate dynamic batch size
    const batchSize = Math.min(
      Math.max(
        TORRENT_CONFIG.PIECE_SELECTION_BATCH_SIZE,
        Math.floor(totalPieces * 0.1),
      ),
      totalPieces,
    );

    // Priority zones
    const criticalZone = Math.min(5, batchSize);
    const highPriorityZone = Math.min(20, batchSize);

    // Select pieces with priority
    for (
      let i = 0;
      i < batchSize;
      i += TORRENT_CONFIG.PIECE_SELECTION_INTERVAL
    ) {
      const pieceIndex = (startPiece + i) % totalPieces;
      const start = pieceIndex * pieceLength;
      const end = Math.min(start + pieceLength - 1, videoFile.length - 1);

      if (start < videoFile.length) {
        const priority = i < criticalZone ? 2 : i < highPriorityZone ? 1 : 0;
        videoFile.select(start, end, priority > 0);
      }
    }

    // Select end pieces for buffer
    const endPieces = Math.min(5, totalPieces - startPiece - batchSize);
    for (let i = 0; i < endPieces; i++) {
      const pieceIndex = totalPieces - 1 - i;
      const start = pieceIndex * pieceLength;
      const end = Math.min(start + pieceLength - 1, videoFile.length - 1);

      if (start < videoFile.length) {
        videoFile.select(start, end, false);
      }
    }
  }

  /**
   * Destroy torrent
   */
  async destroyTorrent(magnet) {
    if (!this.torrents.has(magnet)) {
      logger.debug("Torrent not found in cache", {
        magnet: magnet.substring(0, 60) + "...",
      });
      return null;
    }

    const state = this.torrents.get(magnet);
    let torrentPath = null;

    logger.info("Destroying torrent", {
      magnet: magnet.substring(0, 60) + "...",
    });

    // Clear timer
    state.clearTimer();

    if (state.torrent) {
      torrentPath = state.torrent.path;

      try {
        // Check if torrent still exists in client before removing
        const torrentInClient = this.client.get(magnet);

        if (torrentInClient) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              logger.warn("Torrent remove operation timed out after 5s");
              resolve(); // Resolve anyway to continue cleanup
            }, 5000);

            this.client.remove(magnet, { destroyStore: true }, (err) => {
              clearTimeout(timeout);
              if (err) {
                // Log error but don't reject - we still want to cleanup our state
                logger.warn("Error removing torrent from client", {
                  error: err.message,
                  code: err.code,
                  magnet: magnet.substring(0, 60) + "...",
                });
              }
              resolve(); // Always resolve to continue cleanup
            });
          });

          logger.info("Torrent removed successfully");
        } else {
          logger.debug("Torrent already removed from client");
        }
      } catch (error) {
        logger.error("Error during torrent removal", {
          error: error.message,
          code: error.code,
          stack: error.stack,
          magnet: magnet.substring(0, 60) + "...",
        });
        // Don't throw - continue with cleanup
      }
    } else {
      logger.debug("No active torrent object to remove");
    }

    // Clean up our internal state regardless of removal success
    this.cache.delete(magnet);
    this.torrents.delete(magnet);

    logger.debug("Torrent state cleaned up", {
      magnet: magnet.substring(0, 60) + "...",
      remainingTorrents: this.torrents.size,
    });

    return torrentPath;
  }

  /**
   * Extend auto-delete timer
   */
  extendAutoDelete(magnet) {
    if (!this.torrents.has(magnet)) {
      return;
    }

    const state = this.torrents.get(magnet);
    state.clearTimer();
    this.setupAutoDelete(magnet);

    logger.debug("Auto-delete timer extended", {
      magnet: magnet.substring(0, 60) + "...",
    });
  }

  /**
   * Setup auto-delete timer
   */
  setupAutoDelete(magnet) {
    if (!this.torrents.has(magnet)) {
      return;
    }

    const state = this.torrents.get(magnet);

    state.deleteTimer = setTimeout(async () => {
      logger.info("Auto-deleting torrent", {
        magnet: magnet.substring(0, 60) + "...",
      });

      const torrentPath = await this.destroyTorrent(magnet);

      if (torrentPath && state.videoFile) {
        try {
          await safeDeleteFile(torrentPath);
          logger.info("Torrent files deleted");
        } catch (error) {
          logger.error("Failed to delete torrent files", error);
        }
      }
    }, TORRENT_CONFIG.AUTO_DELETE_DELAY);
  }

  /**
   * Cleanup old torrents
   */
  async cleanupOldTorrents() {
    const now = Date.now();
    const torrentArray = Array.from(this.torrents.entries());

    // Sort by last access time
    const sorted = torrentArray
      .filter(([_, state]) => !state.deleteTimer)
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // Remove up to 3 oldest
    const toRemove = Math.min(3, sorted.length);

    for (let i = 0; i < toRemove; i++) {
      const [magnet] = sorted[i];
      logger.info("Cleaning up old torrent", {
        magnet: magnet.substring(0, 60) + "...",
      });
      await this.destroyTorrent(magnet);
    }
  }

  /**
   * Start monitoring resource usage
   */
  startMonitoring() {
    const monitor = () => {
      try {
        const mem = process.memoryUsage();
        const metrics = {
          activeTorrents: this.torrents.size,
          cacheSize: this.cache.size,
          memoryRSS: Math.round(mem.rss / 1024 / 1024),
          memoryHeap: Math.round(mem.heapUsed / 1024 / 1024),
          uptime: Math.round(process.uptime() / 60),
        };

        logger.debug("Resource metrics", metrics);

        // Check thresholds
        const memoryThreshold = process.arch === "x64" ? 2048 : 1024;

        if (metrics.memoryRSS > memoryThreshold) {
          logger.warn("High memory usage detected", { rss: metrics.memoryRSS });

          if (global.gc) {
            global.gc();
            logger.info("Forced garbage collection");
          }
        }
      } catch (error) {
        logger.error("Error in monitoring", error);
      }
    };

    monitor(); // Run immediately
    this.monitoringInterval = setInterval(
      monitor,
      FS_CONFIG.RESOURCE_LOG_INTERVAL,
    );
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    const cleanup = async () => {
      try {
        const now = Date.now();

        // Cleanup inactive torrents
        for (const [magnet, state] of this.torrents.entries()) {
          if (state.isInactive() && !state.deleteTimer) {
            logger.info("Removing inactive torrent");
            await this.destroyTorrent(magnet);
          }
        }

        // Clean cache
        const cacheEntries = Array.from(this.cache.cache.entries());
        for (const [magnet, item] of cacheEntries) {
          if (now - item.cachedAt > TORRENT_CONFIG.CACHE_CLEANUP_AGE) {
            this.cache.delete(magnet);
          }
        }
      } catch (error) {
        logger.error("Error in periodic cleanup", error);
      }
    };

    cleanup(); // Run immediately
    this.cleanupInterval = setInterval(cleanup, FS_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown() {
    logger.info("Shutting down torrent service");

    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Destroy all torrents
    const magnets = Array.from(this.torrents.keys());
    for (const magnet of magnets) {
      await this.destroyTorrent(magnet);
    }

    // Destroy client
    if (this.client) {
      await new Promise((resolve) => {
        this.client.destroy(resolve);
      });
    }

    this.cache.clear();
    this.isInitialized = false;

    logger.info("Torrent service shut down successfully");
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      activeTorrents: this.torrents.size,
      cacheSize: this.cache.size,
      isInitialized: this.isInitialized,
      downloadDir: this.downloadDir,
    };
  }
}

// Create singleton instance
const torrentService = new TorrentService();

// Export instance and class
export { torrentService, TorrentService };
export default torrentService;
