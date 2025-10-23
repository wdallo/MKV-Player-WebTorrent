// Torrent logic and state management

import WebTorrent from "webtorrent";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.join(__dirname, "../downloads");

// Watch for file deletions in the download directory
// If a video file is deleted from disk, remove its torrent from the client and memory
try {
  fs.watch(DOWNLOAD_DIR, (eventType, filename) => {
    if (eventType === "rename" && filename) {
      const filePath = path.join(DOWNLOAD_DIR, filename);
      fs.stat(filePath, (err, stats) => {
        if (err && err.code === "ENOENT") {
          // File was deleted, try to find and remove torrent
          for (const [magnet, state] of Object.entries(torrents)) {
            if (state.videoFile && state.videoFile.name === filename) {
              console.log(
                `File deleted: ${filename}, cleaning up torrent data`
              );

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
              }, 5000); // 5 seconds for frontend to detect

              break;
            }
          }
        }
      });
    }
  });
} catch (e) {
  console.error("Failed to watch download directory:", e);
}

// Create a WebTorrent client with custom options
const client = new WebTorrent({
  maxConns: 50, // Lowered to avoid resource exhaustion
  nodeId: null, // Random node ID
  peerId: null, // Random peer ID
  tracker: true, // Enable tracker
  dht: true, // Enable DHT
  lsd: true, // Enable local service discovery
  webSeeds: true, // Enable web seeds
  utp: true, // Enable uTP
  blocklist: false, // Disable blocklist for speed
});

// Store all active torrents and their state
// Structure: magnet -> { torrent, videoFile, videoMime, lastAccess, deleteTimer }
const torrents = {};

// Auto-delete configuration
const AUTO_DELETE_DELAY = 72 * 60 * 60 * 1000; // 72 hours in milliseconds

/**
 * Get or add a torrent to the client.
 * If already present, returns the state and boosts priority for fast streaming.
 * If not, adds the torrent and sets up video file selection.
 * @param {string} magnet - Magnet URI
 * @param {function} [cb] - Optional callback when torrent is ready
 * @returns {object|null} Torrent state or null if invalid
 */
function getOrAddTorrent(magnet, cb) {
  if (!magnet || !magnet.startsWith("magnet:")) return null;
  if (torrents[magnet]) {
    const videoFile = torrents[magnet].videoFile;
    if (videoFile) {
      // Aggressively select the first 10MB for ultra-fast streaming
      const end = Math.min(videoFile.length - 1, 10 * 1024 * 1024 - 1);
      videoFile.select(0, end, true); // High priority

      // Also select critical pieces at intervals for smoother playback
      if (videoFile._torrent) {
        const pieceLength = videoFile._torrent.pieceLength || 32768;
        const totalPieces = Math.floor(videoFile.length / pieceLength);
        for (let i = 0; i < Math.min(50, totalPieces); i += 5) {
          const start = i * pieceLength;
          const end = Math.min(start + pieceLength - 1, videoFile.length - 1);
          videoFile.select(start, end, true);
        }
      }
    }
    torrents[magnet].lastAccess = Date.now();
    if (cb) cb(torrents[magnet].torrent);
    return torrents[magnet];
  }
  // Create new torrent state
  torrents[magnet] = {
    torrent: null,
    videoFile: null,
    videoMime: "video/mp4",
    lastAccess: Date.now(),
    deleteTimer: null,
  };

  // Set up auto-delete timer (72 hours)
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
    console.log(`Auto-delete scheduled for ${magnetUri} in 72 hours`);
  };

  setupAutoDelete(magnet);
  // Add torrent to client
  torrents[magnet].torrent = client.add(
    magnet,
    { path: DOWNLOAD_DIR },
    (torrent) => {
      // Find the main video file (.mp4 or .mkv)
      const videoFile = torrent.files.find(
        (f) => f.name.endsWith(".mp4") || f.name.endsWith(".mkv")
      );
      torrents[magnet].videoFile = videoFile;
      torrents[magnet].videoMime =
        videoFile && videoFile.name.endsWith(".mkv")
          ? "video/x-matroska"
          : "video/mp4";
      if (videoFile) {
        // Select the first 5MB for streaming
        const end = Math.min(videoFile.length - 1, 5 * 1024 * 1024 - 1);
        videoFile.select(0, end, false);
      }
      torrents[magnet].lastAccess = Date.now();
      if (cb) cb(torrent);
    }
  );
  return torrents[magnet];
}

/**
 * Destroys a torrent and returns its path for cleanup
 * @param {string} magnet - Magnet URI
 */
function destroyTorrent(magnet) {
  if (!magnet || !torrents[magnet]) return null;
  const state = torrents[magnet];
  let torrentPath = null;

  // Clear auto-delete timer if it exists
  if (state.deleteTimer) {
    clearTimeout(state.deleteTimer);
    console.log("Cleared auto-delete timer for:", magnet);
  }

  if (state.torrent) {
    // Get the path before destroying
    torrentPath = state.torrent.path;
    console.log("Destroying torrent at path:", torrentPath);

    client.remove(magnet, () => {
      console.log("Torrent removed from client");
    });
  }

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
