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
const torrents = {}; // magnet -> { torrent, videoFile, videoMime, lastAccess }

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
  torrents[magnet] = {
    torrent: null,
    videoFile: null,
    videoMime: "video/mp4",
    lastAccess: Date.now(),
  };
  torrents[magnet].torrent = client.add(
    magnet,
    { path: DOWNLOAD_DIR },
    (torrent) => {
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
