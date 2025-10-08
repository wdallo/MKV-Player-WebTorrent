// Video streaming controller
import { getOrAddTorrent, destroyTorrent } from "../services/torrentService.js";
import { rm } from "fs/promises";

const MIN_READY_BYTES = 256 * 1024; // 256KB for ultra-fast start
const PRIORITY_PIECES = 20; // Download first 20 pieces with priority

// Streams video content for a given magnet link, supporting HTTP range requests
export function streamVideo(req, res) {
  const magnet = req.query.url;
  console.log(`[VIDEO] Request for video. Magnet: ${magnet}`);
  if (!magnet) {
    console.warn("[VIDEO] Missing url param");
    return res.status(400).send("Missing url param");
  }
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    console.warn(`[VIDEO] Video not ready for magnet: ${magnet}`);
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }
  const videoFile = state.videoFile;
  const videoMime = state.videoMime;

  // Set priority for first pieces (contains MKV metadata)
  if (videoFile._torrent) {
    // Download first PRIORITY_PIECES with highest priority
    for (
      let i = 0;
      i < Math.min(PRIORITY_PIECES, videoFile._torrent.pieces.length);
      i++
    ) {
      videoFile._torrent.select(i, i, true); // High priority
    }
    // Also prioritize the video file specifically
    videoFile._torrent.select(videoFile._startPiece, videoFile._endPiece, true);
  }
  const firstPiece = videoFile._startPiece || 0;
  const firstPieceDownloaded =
    videoFile._torrent && videoFile._torrent.bitfield
      ? videoFile._torrent.bitfield.get(firstPiece)
      : false;
  // If more than 256KB is downloaded, allow streaming
  if (videoFile.downloaded >= MIN_READY_BYTES) {
    console.log(
      `[VIDEO] Allowing stream: downloaded=${videoFile.downloaded} bytes (>256KB)`
    );
  } else if (videoFile.downloaded < MIN_READY_BYTES || !firstPieceDownloaded) {
    // Not enough data to start streaming
    console.log(
      `[VIDEO] Not enough data: downloaded=${videoFile.downloaded} bytes, need at least ${MIN_READY_BYTES} bytes for ${videoFile.name}`
    );
    console.log(`[VIDEO] First piece downloaded: ${!!firstPieceDownloaded}`);
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }
  const range = req.headers.range;
  const fileLength = videoFile.length;
  let stream;
  // Helper: get last downloaded byte
  const lastDownloadedByte = videoFile.downloaded - 1;
  if (!range) {
    // No range header: serve from 0 up to downloaded bytes
    const end = Math.min(fileLength - 1, lastDownloadedByte);
    if (end < 0) {
      res.status(416).send("No data available yet");
      return;
    }
    const chunkSize = end + 1;
    console.log(
      `[VIDEO] No range header. Sending downloaded part: 0-${end} (${chunkSize} bytes) of ${videoFile.name}`
    );
    res.setHeader("Content-Type", videoMime);
    res.setHeader("Content-Length", chunkSize);
    stream = videoFile.createReadStream({ start: 0, end });
    stream.on("error", (err) => {
      console.error("[VIDEO] Stream error (no range):", err);
      res.status(500).end("Stream error");
    });
    res.on("close", () => {
      stream.destroy();
    });
    stream.pipe(res);
    return;
  }
  // Handle HTTP range requests for seeking/partial playback
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  let end = parts[1] ? parseInt(parts[1], 10) : fileLength - 1;
  // Only serve up to downloaded bytes
  if (start > lastDownloadedByte) {
    res.status(416).setHeader("Content-Range", `bytes */${fileLength}`);
    res.end();
    return;
  }
  end = Math.min(end, lastDownloadedByte);
  const chunkSize = end - start + 1;
  console.log(
    `[VIDEO] Range request: ${start}-${end} (${chunkSize} bytes) for ${videoFile.name}`
  );
  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileLength}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", chunkSize);
  res.setHeader("Content-Type", videoMime);
  stream = videoFile.createReadStream({ start, end });
  console.log(`[VIDEO] Stream created for range: ${start}-${end}`);
  stream.on("error", (err) => {
    console.error("[VIDEO] Stream error (range):", err);
    res.status(500).end("Stream error");
  });
  stream.on("end", () => {
    console.log("[VIDEO] Stream ended (range)");
  });
  stream.on("close", () => {
    console.log("[VIDEO] Stream closed (range)");
  });
  res.on("close", () => {
    console.log("[VIDEO] Response closed by client");
    stream.destroy();
  });
  stream.pipe(res);
}

// Handles cleanup: destroys torrent and deletes downloaded files
export async function goodbye(req, res) {
  const magnet = req.query.url;
  // Always destroy the torrent first
  const torrentPath = destroyTorrent(magnet);
  if (torrentPath) {
    try {
      // Recursively delete the torrent's files/folder
      await rm(torrentPath, { recursive: true, force: true });
      res.status(200).send("Torrent destroyed and files deleted");
    } catch (err) {
      console.error("Failed to delete files:", err);
      res.status(500).send("Torrent destroyed, but failed to delete files");
    }
  } else {
    res.status(200).send("Torrent destroyed (no files to delete)");
  }
}
