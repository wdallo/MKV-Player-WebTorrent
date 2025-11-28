// Torrent logic and state management

import WebTorrent from "webtorrent";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { PERF_CONFIG } from "../config/all.config.js";

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.join(__dirname, "../downloads");

// Watch for file deletions in the download directory with debouncing
// If a video file is deleted from disk, remove its torrent from the client and memory
let fileWatchTimeout = null;
const fileEventQueue = new Map();

function processFileEvent(filename) {
  const filePath = path.join(DOWNLOAD_DIR, filename);

  // Use non-blocking stat
  fs.stat(filePath, (err, stats) => {
    if (err && err.code === "ENOENT") {
      // File was deleted, find and remove torrent efficiently
      const torrentEntries = Object.entries(torrents);
      for (const [magnet, state] of torrentEntries) {
        if (state.videoFile?.name === filename) {
          console.log(`File deleted: ${filename}, cleaning up torrent data`);

          // Remove torrent from client
          if (state.torrent) {
            client.remove(magnet, () => {
              console.log(`Torrent removed for deleted file: ${filename}`);
            });
          }

          // Clear auto-delete timer if it exists
          if (state.deleteTimer) {
            clearTimeout(state.deleteTimer);
            console.log(`Cleared auto-delete timer for: ${filename}`);
          }

          // Mark this torrent as deleted so frontend can clean localStorage
          state.fileDeleted = true;
          state.deletedAt = Date.now();

          // Keep the state briefly so frontend can detect deletion and clean localStorage
          setTimeout(() => {
            delete torrents[magnet];
            console.log(`Torrent state cleaned up for: ${filename}`);
          }, 5000);

          break;
        }
      }
    }
  });
}

try {
  fs.watch(DOWNLOAD_DIR, { persistent: false }, (eventType, filename) => {
    if (eventType === "rename" && filename) {
      // Debounce file events to prevent excessive processing
      fileEventQueue.set(filename, Date.now());

      if (fileWatchTimeout) clearTimeout(fileWatchTimeout);

      fileWatchTimeout = setTimeout(() => {
        for (const [file] of fileEventQueue) {
          processFileEvent(file);
        }
        fileEventQueue.clear();
      }, PERF_CONFIG.FILE_WATCH_DEBOUNCE);
    }
  });
} catch (e) {
  console.error("Failed to watch download directory:", e);
}

// Create a WebTorrent client with optimized performance settings
const client = new WebTorrent({
  maxConns: 35, // Optimized connection limit
  nodeId: null, // Random node ID
  peerId: null, // Random peer ID
  tracker: {
    announce: [], // Will use default trackers
    getAnnounceOpts() {
      return {
        numwant: 50, // Request more peers
        compact: 1, // Compact response
      };
    },
  },
  dht: true, // Enable DHT
  lsd: true, // Enable local service discovery
  webSeeds: true, // Enable web seeds
  utp: true, // Enable uTP for better NAT traversal
  blocklist: false, // Disable blocklist for speed
  // Performance optimizations
  downloadLimit: -1, // No download limit
  uploadLimit: 1024 * 1024, // 1MB/s upload limit to preserve bandwidth
});

// Store all active torrents and their state with performance tracking
// Structure: magnet -> { torrent, videoFile, videoMime, lastAccess, deleteTimer, accessCount, createdAt }
const torrents = {};
const torrentCache = new Map(); // LRU cache for frequently accessed torrents

// Auto-delete configuration
const AUTO_DELETE_DELAY = 72 * 60 * 60 * 1000; // 72 hours in milliseconds

// Performance helpers
function updateTorrentCache(magnet, state) {
  torrentCache.set(magnet, {
    ...state,
    cachedAt: Date.now(),
  });

  // Maintain cache size
  if (torrentCache.size > 50) {
    const firstKey = torrentCache.keys().next().value;
    torrentCache.delete(firstKey);
  }
}

function selectPiecesOptimized(videoFile, seekPosition = 0) {
  if (!videoFile?._torrent) return;

  const pieceLength = videoFile._torrent.pieceLength || 32768;
  const totalPieces = Math.floor(videoFile.length / pieceLength);
  const startPiece = Math.floor(seekPosition / pieceLength);

  // Select pieces in smaller batches for better performance
  const batchSize = Math.min(
    PERF_CONFIG.PIECE_SELECTION_BATCH_SIZE,
    totalPieces
  );

  for (let i = 0; i < batchSize; i += PERF_CONFIG.PIECE_SELECTION_INTERVAL) {
    const pieceIndex = (startPiece + i) % totalPieces;
    const start = pieceIndex * pieceLength;
    const end = Math.min(start + pieceLength - 1, videoFile.length - 1);

    if (start < videoFile.length) {
      videoFile.select(start, end, i < 10); // High priority for first 10 pieces
    }
  }
}

/**
 * Get or add a torrent to the client with performance optimizations.
 * @param {string} magnet - Magnet URI
 * @param {function} [cb] - Optional callback when torrent is ready
 * @param {number} [seekPosition] - Optional seek position for piece selection
 * @returns {object|null} Torrent state or null if invalid
 */
function getOrAddTorrent(magnet, cb, seekPosition = 0) {
  if (!magnet || !magnet.startsWith("magnet:")) return null;

  // Check cache first
  const cached = torrentCache.get(magnet);
  if (cached && Date.now() - cached.cachedAt < 30000) {
    // 30 second cache
    if (cb) cb(cached.torrent);
    return cached;
  }

  // Check if torrent exists
  if (torrents[magnet]) {
    const state = torrents[magnet];
    const videoFile = state.videoFile;

    if (videoFile) {
      // Optimized piece selection based on seek position
      const downloadSize =
        seekPosition > 0
          ? PERF_CONFIG.STREAMING_DOWNLOAD_SIZE
          : PERF_CONFIG.INITIAL_DOWNLOAD_SIZE;

      const end = Math.min(
        videoFile.length - 1,
        seekPosition + downloadSize - 1
      );
      videoFile.select(seekPosition, end, true); // High priority

      // Select additional pieces optimally
      selectPiecesOptimized(videoFile, seekPosition);
    }

    // Update access tracking
    state.lastAccess = Date.now();
    state.accessCount = (state.accessCount || 0) + 1;

    // Update cache
    updateTorrentCache(magnet, state);

    if (cb) cb(state.torrent);
    return state;
  }

  // Prevent too many concurrent torrents
  const activeTorrents = Object.keys(torrents).length;
  if (activeTorrents >= PERF_CONFIG.MAX_CONCURRENT_TORRENTS) {
    console.warn(
      `Max concurrent torrents reached (${activeTorrents}). Consider cleanup.`
    );
    // Cleanup least recently used torrents
    cleanupOldTorrents();
  }

  // Create new torrent state
  torrents[magnet] = {
    torrent: null,
    videoFile: null,
    videoMime: "video/mp4",
    lastAccess: Date.now(),
    deleteTimer: null,
    accessCount: 1,
    createdAt: Date.now(),
  };

  // Set up auto-delete timer with better error handling
  const setupAutoDelete = (magnetUri) => {
    const timer = setTimeout(() => {
      console.log(`Auto-deleting torrent after 72 hours: ${magnetUri}`);
      const torrentPath = destroyTorrent(magnetUri);
      if (torrentPath) {
        import("fs").then(({ rm }) => {
          rm(torrentPath, { recursive: true, force: true })
            .then(() => console.log(`Auto-deleted: ${torrentPath}`))
            .catch((err) => console.error(`Failed to auto-delete: ${err}`));
        });
      }
    }, AUTO_DELETE_DELAY);

    torrents[magnetUri].deleteTimer = timer;
    if (process.env.NODE_ENV !== "production") {
      console.log(`Auto-delete scheduled for ${magnetUri} in 72 hours`);
    }
  };

  setupAutoDelete(magnet);

  // Add torrent to client with error handling
  try {
    torrents[magnet].torrent = client.add(
      magnet,
      { path: DOWNLOAD_DIR, strategy: "sequential" }, // Sequential for streaming
      (torrent) => {
        // Find the main video file (.mp4 or .mkv)
        const videoFile = torrent.files.find(
          (f) => f.name.endsWith(".mp4") || f.name.endsWith(".mkv")
        );

        if (videoFile) {
          torrents[magnet].videoFile = videoFile;
          torrents[magnet].videoMime = videoFile.name.endsWith(".mkv")
            ? "video/x-matroska"
            : "video/mp4";

          // Optimized initial piece selection
          const end = Math.min(
            videoFile.length - 1,
            PERF_CONFIG.STREAMING_DOWNLOAD_SIZE - 1
          );
          videoFile.select(0, end, false);

          // Select additional pieces for smooth playback
          selectPiecesOptimized(videoFile, seekPosition);
        }

        torrents[magnet].lastAccess = Date.now();
        updateTorrentCache(magnet, torrents[magnet]);

        if (cb) cb(torrent);
      }
    );

    // Add error handling for torrent
    if (torrents[magnet].torrent) {
      torrents[magnet].torrent.on("error", (err) => {
        console.error(`Torrent error for ${magnet}:`, err);
        if (cb) cb(null, err);
      });
    }
  } catch (error) {
    console.error(`Failed to add torrent ${magnet}:`, error);
    delete torrents[magnet];
    if (cb) cb(null, error);
    return null;
  }

  return torrents[magnet];
}

// Cleanup old torrents to free memory
function cleanupOldTorrents() {
  const now = Date.now();
  const torrentEntries = Object.entries(torrents);

  // Sort by last access time and remove oldest
  const sortedTorrents = torrentEntries
    .filter(([_, state]) => !state.deleteTimer) // Don't cleanup torrents with auto-delete
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

  const toRemove = Math.min(3, sortedTorrents.length); // Remove up to 3 old torrents

  for (let i = 0; i < toRemove; i++) {
    const [magnet] = sortedTorrents[i];
    console.log(`Cleaning up old torrent: ${magnet}`);
    destroyTorrent(magnet);
  }
}

// Enhanced resource usage monitoring with performance metrics
function logResourceUsage() {
  try {
    const mem = process.memoryUsage();
    const activeTorrents = Object.keys(torrents).length;
    const cacheSize = torrentCache.size;

    // Performance metrics
    const metrics = {
      activeTorrents,
      cacheSize,
      memoryRSS: Math.round(mem.rss / 1024 / 1024), // MB
      memoryHeap: Math.round(mem.heapUsed / 1024 / 1024), // MB
      uptime: Math.round(process.uptime() / 60), // minutes
    };

    // Log warnings for performance issues
    if (activeTorrents > PERF_CONFIG.MAX_CONCURRENT_TORRENTS) {
      console.warn(`[PERF] High active torrent count: ${activeTorrents}`);
      cleanupOldTorrents();
    }

    if (mem.rss > 1.5 * 1024 * 1024 * 1024) {
      // 1.5GB
      console.warn(`[PERF] High memory usage: ${metrics.memoryRSS} MB`);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[PERF] Resource metrics:", metrics);
    }
  } catch (error) {
    console.error("Error logging resource usage:", error);
  } finally {
    // Schedule next check
    setTimeout(logResourceUsage, PERF_CONFIG.RESOURCE_LOG_INTERVAL);
  }
}

// Periodic cleanup of inactive torrents
function periodicCleanup() {
  const now = Date.now();
  const inactiveThreshold = 60 * 60 * 1000; // 1 hour

  for (const [magnet, state] of Object.entries(torrents)) {
    if (now - state.lastAccess > inactiveThreshold && !state.deleteTimer) {
      console.log(`Cleaning up inactive torrent: ${magnet}`);
      destroyTorrent(magnet);
    }
  }

  // Clear old cache entries
  for (const [magnet, cached] of torrentCache.entries()) {
    if (now - cached.cachedAt > 5 * 60 * 1000) {
      // 5 minutes
      torrentCache.delete(magnet);
    }
  }

  setTimeout(periodicCleanup, PERF_CONFIG.CLEANUP_INTERVAL);
}

// Start monitoring
logResourceUsage();
periodicCleanup();

/**
 * Destroys a torrent and returns its path for cleanup with optimized cleanup
 * @param {string} magnet - Magnet URI
 */
function destroyTorrent(magnet) {
  if (!magnet || !torrents[magnet]) return null;

  const state = torrents[magnet];
  let torrentPath = null;

  // Clear auto-delete timer if it exists
  if (state.deleteTimer) {
    clearTimeout(state.deleteTimer);
    if (process.env.NODE_ENV !== "production") {
      console.log("Cleared auto-delete timer for:", magnet);
    }
  }

  if (state.torrent) {
    // Get the path before destroying
    torrentPath = state.torrent.path;

    if (process.env.NODE_ENV !== "production") {
      console.log("Destroying torrent at path:", torrentPath);
    }

    // Remove torrent with proper cleanup
    try {
      client.remove(magnet, { destroyStore: true }, () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("Torrent removed from client");
        }
      });
    } catch (error) {
      console.error(`Error removing torrent ${magnet}:`, error);
    }
  }

  // Clean up from cache
  torrentCache.delete(magnet);

  // Clean up the state
  delete torrents[magnet];

  return torrentPath;
}

/**
 * Extend auto-delete timer for a torrent (reset to 72 hours from now)
 * @param {string} magnet - Magnet URI
 */
function extendAutoDelete(magnet) {
  if (!magnet || !torrents[magnet]) return;

  const state = torrents[magnet];

  // Clear existing timer
  if (state.deleteTimer) {
    clearTimeout(state.deleteTimer);
  }

  // Set new timer
  const timer = setTimeout(() => {
    console.log(`Auto-deleting torrent after 72 hours: ${magnet}`);
    const torrentPath = destroyTorrent(magnet);
    if (torrentPath) {
      import("fs").then(({ rm }) => {
        rm(torrentPath, { recursive: true, force: true })
          .then(() => console.log(`Auto-deleted: ${torrentPath}`))
          .catch((err) => console.error(`Failed to auto-delete: ${err}`));
      });
    }
  }, AUTO_DELETE_DELAY);

  state.deleteTimer = timer;
  console.log(`Auto-delete timer extended for ${magnet} (72 hours from now)`);
}

export { client, torrents, getOrAddTorrent, destroyTorrent, extendAutoDelete };
