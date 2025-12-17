// Video streaming controller
import {
  getOrAddTorrent,
  destroyTorrent,
  extendAutoDelete,
} from "../services/torrentService.js";
import { rm } from "fs/promises";

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Constants
const MIN_READY_BYTES = 256 * 1024; // 256KB for ultra-fast start
const PRIORITY_PIECES = 20; // Download first 20 pieces with priority
const RANGE_ADJUSTMENT_THRESHOLD = 80; // Adjust range at 80%+ download

// Streams video content for a given magnet link, supporting HTTP range requests
export function streamVideo(req, res) {
  const magnet = req.query.url;
  const audioTrack = req.query.audioTrack;
  const startTime = req.query.t;

  if (!magnet) {
    console.warn("[VIDEO] Missing url param");
    return res.status(400).send("Missing url param");
  }

  // Extend auto-delete timer when video is accessed
  extendAutoDelete(magnet);

  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    console.warn(`[VIDEO] Video not ready for magnet: ${magnet}`);
    console.warn(`[VIDEO] State exists: ${!!state}`);
    if (state) {
      console.warn(`[VIDEO] VideoFile exists: ${!!state.videoFile}`);
      console.warn(
        `[VIDEO] Torrent status: ${
          state.torrent ? state.torrent.progress : "no torrent"
        }`
      );
    }
    res.status(200).send("NOT_READY");
    return;
  }
  const videoFile = state.videoFile;
  const videoMime = state.videoMime;

  // Check if audio track transcoding is requested
  if (audioTrack !== undefined && audioTrack !== "0") {
    console.log(
      `[VIDEO] Audio track ${audioTrack} requested, using transcoding`
    );
    return handleAudioTrackTranscoding(req, res, magnet, audioTrack, startTime);
  }

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

  // Check if enough data is available to start streaming
  if (videoFile.downloaded < MIN_READY_BYTES || !firstPieceDownloaded) {
    console.log(
      `[VIDEO] Not ready: downloaded=${
        videoFile.downloaded
      }B/${MIN_READY_BYTES}B, firstPiece=${!!firstPieceDownloaded} for ${
        videoFile.name
      }`
    );
    res.status(200).send("NOT_READY");
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
    const downloadPercentage = (videoFile.downloaded / fileLength) * 100;

    // Be more lenient with range adjustments at 80%+ download
    if (downloadPercentage > RANGE_ADJUSTMENT_THRESHOLD && start < fileLength) {
      // Adjust the start to the nearest available byte
      const adjustedStart = Math.min(start, lastDownloadedByte);
      console.log(
        `[VIDEO] Adjusting range: requested=${start}, serving from=${adjustedStart} (${downloadPercentage.toFixed(
          1
        )}% downloaded)`
      );
      end = Math.min(end, lastDownloadedByte);
      const chunkSize = end - adjustedStart + 1;

      if (chunkSize > 0) {
        res.status(206);
        res.setHeader(
          "Content-Range",
          `bytes ${adjustedStart}-${end}/${fileLength}`
        );
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", chunkSize);
        res.setHeader("Content-Type", videoMime);
        stream = videoFile.createReadStream({ start: adjustedStart, end });
      } else {
        // Still return 416 if no valid chunk available
        res.status(416).setHeader("Content-Range", `bytes */${fileLength}`);
        res.end();
        return;
      }
    } else {
      res.status(416).setHeader("Content-Range", `bytes */${fileLength}`);
      res.end();
      return;
    }
  } else {
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
  }
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
  console.log("=== GOODBYE ENDPOINT CALLED ===");
  console.log("Request method:", req.method);
  console.log("Request query:", req.query);
  console.log("Request body:", req.body);

  let magnet = req.query.url;
  if (!magnet && req.body && req.body.url) {
    magnet = req.body.url;
  }
  console.log("GOODBYE called with magnet:", magnet);

  if (!magnet) {
    console.log("No magnet provided");
    return res.status(400).send("Missing magnet URL");
  }

  const torrentPath = destroyTorrent(magnet);
  console.log("Torrent path to delete:", torrentPath);

  // Always instruct client to clear localStorage for this magnet
  const shouldClearLocalStorage = true;

  if (torrentPath) {
    try {
      await rm(torrentPath, { recursive: true, force: true });
      console.log("Successfully deleted:", torrentPath);
      res.status(200).json({
        success: true,
        message: "Torrent destroyed and files deleted",
        shouldClearLocalStorage,
        magnet,
      });
    } catch (err) {
      console.error("Failed to delete files:", err);
      res.status(500).json({
        success: false,
        message: "Torrent destroyed, but failed to delete files",
        shouldClearLocalStorage,
        magnet,
      });
    }
  } else {
    console.log("No torrent path found for magnet");
    res.status(200).json({
      success: true,
      message: "Torrent destroyed (no files to delete)",
      shouldClearLocalStorage,
      magnet,
    });
  }
}

// Clean localStorage for a specific magnet URL
export function cleanLocalStorage(req, res) {
  const magnet = req.query.url || req.body?.url;

  if (!magnet) {
    return res.status(400).json({ error: "Missing magnet URL" });
  }

  // Return the magnet URL so client can clean its localStorage
  res.json({
    success: true,
    magnet: magnet,
    message: "LocalStorage cleanup requested",
  });
}

// Handle audio track transcoding using FFmpeg
function handleAudioTrackTranscoding(req, res, magnet, audioTrack, startTime) {
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    return res.status(200).send("NOT_READY");
  }

  const videoFile = state.videoFile;

  // Check if enough data is downloaded for remuxing (much less needed for lossless)
  const MIN_TRANSCODE_BYTES = 1 * 1024 * 1024; // 1MB for lossless remuxing (was 5MB)
  if (videoFile.downloaded < MIN_TRANSCODE_BYTES) {
    console.log(
      `[TRANSCODE] Not enough data for remuxing: ${videoFile.downloaded} < ${MIN_TRANSCODE_BYTES}`
    );
    return res.status(200).send("NOT_READY");
  }

  try {
    // Set appropriate headers for MKV streaming
    res.setHeader("Content-Type", "video/x-matroska");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Accept-Ranges", "bytes");

    // Create a readable stream from the torrent file for ffmpeg
    const inputStream = videoFile.createReadStream();

    console.log(
      `[TRANSCODE] Starting LOSSLESS remux with audio track ${audioTrack}`
    );

    // Create ffmpeg command for LOSSLESS remuxing with specific audio track
    const command = ffmpeg()
      .input(inputStream)
      .videoCodec("copy") // LOSSLESS - Copy video stream without re-encoding
      .audioCodec("copy") // LOSSLESS - Copy audio stream without re-encoding
      .format("matroska") // Keep original MKV format for best compatibility
      .outputOptions([
        `-map`,
        `0:v:0`, // First video stream
        `-map`,
        `0:a:${audioTrack}`, // Selected audio track
        "-avoid_negative_ts",
        "make_zero", // Fix timing issues
        "-copyts", // Copy timestamps exactly
        "-start_at_zero", // Start at zero
        "-threads",
        "1", // Minimal CPU usage for copy operations
        "-f",
        "matroska", // Force MKV output
      ]);

    // Add start time if specified
    if (startTime && parseFloat(startTime) > 0) {
      command.seekInput(parseFloat(startTime));
    }

    // Handle errors - simple error response instead of recursive fallback
    command.on("error", (err) => {
      console.error("[TRANSCODE] Audio transcoding error:", err);
      console.log("[TRANSCODE] Failed to switch audio track");
      if (!res.headersSent) {
        res.status(500).send("Audio track switching failed");
      }
    });

    command.on("start", (commandLine) => {
      console.log(`[TRANSCODE] Started: ${commandLine}`);
    });

    command.on("progress", (progress) => {
      if (progress.percent) {
        console.log(
          `[TRANSCODE] Processing: ${Math.round(progress.percent)}% done`
        );
      }
    });

    // Ensure response is closed and finalized when FFmpeg finishes
    command.on("end", () => {
      console.log("[TRANSCODE] FFmpeg remuxing finished, closing response");
      if (!res.headersSent) {
        res.end();
      }
    });

    // Start streaming
    command.pipe(res, { end: true });
  } catch (error) {
    console.error("Error setting up audio track transcoding:", error);
    if (!res.headersSent) {
      res.status(500).send("Failed to setup audio transcoding");
    }
  }
}
