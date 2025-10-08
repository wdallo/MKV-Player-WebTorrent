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
              if (state.torrent) {
                client.remove(magnet, () => {
                  // Optionally log or handle callback
                });
              }
              delete torrents[magnet];
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
// Structure: magnet -> { torrent, videoFile, videoMime, lastAccess }
const torrents = {};

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
  };
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
 * Destroy a torrent and remove it from the client and memory.
 * @param {string} magnet - Magnet URI
 */
function destroyTorrent(magnet) {
  if (!magnet || !torrents[magnet]) return;
  const state = torrents[magnet];
  if (state.torrent) {
    client.remove(magnet, () => {
      // Optionally log or handle callback
    });
  }
  delete torrents[magnet];
}

export { client, torrents, getOrAddTorrent, destroyTorrent };
