/**
 * Refactored Video Controller with improved streaming and error handling
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { STREAMING_CONFIG } from "../configs/environment.config.js";
import { createLogger } from "../utils/logger.js";
import {
  validateRange,
  validateTrackNumber,
  validateSeekTime,
} from "../utils/validator.js";
import { asyncHandler } from "../utils/security.js";

const logger = createLogger("VIDEO_CONTROLLER");

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Stream video with HTTP range support
 */
export const streamVideo = asyncHandler(async (req, res) => {
  const { url: magnet, audioTrack, t: startTime } = req.query;

  if (!magnet) {
    logger.warn("Missing magnet URL in stream request");
    return res.status(400).json({ error: "Missing magnet URL" });
  }

  // Get torrent service (will be injected via middleware or imported)
  const { torrentService } = await import("../services/torrentService.js");

  // Extend auto-delete timer
  torrentService.extendAutoDelete(magnet);

  // Get or add torrent
  const state = await torrentService.getOrAddTorrent(magnet);

  if (!state || !state.videoFile) {
    logger.debug("Video not ready for streaming", {
      hasState: !!state,
      hasVideoFile: !!state?.videoFile,
    });
    return res.status(200).send("NOT_READY");
  }

  // Check if audio transcoding is needed
  const audioTrackNum = validateTrackNumber(audioTrack);
  if (audioTrackNum !== 0) {
    logger.info("Audio track transcoding requested", { track: audioTrackNum });
    return handleAudioTranscoding(req, res, magnet, audioTrackNum, startTime);
  }

  // Stream video
  return streamVideoFile(req, res, state);
});

/**
 * Stream video file with range support
 */
function streamVideoFile(req, res, state) {
  const { videoFile, videoMime } = state;
  const fileLength = videoFile.length;
  const range = req.headers.range;

  // Check if ready
  if (!state.isReady()) {
    logger.debug("Insufficient data for streaming", {
      downloaded: videoFile.downloaded,
      required: STREAMING_CONFIG.MIN_READY_BYTES,
    });
    return res.status(200).send("NOT_READY");
  }

  // Prioritize first pieces (contains metadata)
  if (videoFile._torrent) {
    const piecesToPrioritize = Math.min(
      STREAMING_CONFIG.PRIORITY_PIECES,
      videoFile._torrent.pieces.length,
    );

    for (let i = 0; i < piecesToPrioritize; i++) {
      videoFile._torrent.select(i, i, true);
    }
  }

  const lastDownloadedByte = videoFile.downloaded - 1;

  // No range header - serve from start
  if (!range) {
    return serveFullContent(
      res,
      videoFile,
      videoMime,
      lastDownloadedByte,
      fileLength,
    );
  }

  // Handle range request
  return serveRangeContent(
    req,
    res,
    videoFile,
    videoMime,
    range,
    fileLength,
    lastDownloadedByte,
  );
}

/**
 * Serve full content without range
 */
function serveFullContent(
  res,
  videoFile,
  videoMime,
  lastDownloadedByte,
  fileLength,
) {
  const end = Math.min(fileLength - 1, lastDownloadedByte);

  if (end < 0) {
    logger.warn("No data available for streaming");
    return res.status(416).send("No data available yet");
  }

  const chunkSize = end + 1;

  logger.info("Serving full content", {
    bytes: `0-${end}`,
    size: chunkSize,
    file: videoFile.name,
  });

  res.setHeader("Content-Type", videoMime);
  res.setHeader("Content-Length", chunkSize);
  res.setHeader("Accept-Ranges", "bytes");

  const stream = videoFile.createReadStream({ start: 0, end });

  setupStreamHandlers(stream, res, videoFile.name);
  stream.pipe(res);
}

/**
 * Serve range content
 */
function serveRangeContent(
  req,
  res,
  videoFile,
  videoMime,
  range,
  fileLength,
  lastDownloadedByte,
) {
  const rangeData = validateRange(range, fileLength);

  if (!rangeData) {
    logger.warn("Invalid range request", { range });
    return res
      .status(416)
      .setHeader("Content-Range", `bytes */${fileLength}`)
      .end();
  }

  let { start, end } = rangeData;

  // Check if requested range is available
  if (start > lastDownloadedByte) {
    const downloadPercentage = (videoFile.downloaded / fileLength) * 100;

    // Adjust range if mostly downloaded
    if (
      downloadPercentage > STREAMING_CONFIG.RANGE_ADJUSTMENT_THRESHOLD &&
      start < fileLength
    ) {
      const adjustedStart = Math.min(start, lastDownloadedByte);
      end = Math.min(end, lastDownloadedByte);

      logger.info("Adjusting range request", {
        requested: start,
        adjusted: adjustedStart,
        downloadPercent: downloadPercentage.toFixed(1),
      });

      start = adjustedStart;
    } else {
      logger.warn("Range not available", {
        start,
        downloaded: lastDownloadedByte,
        percent: downloadPercentage.toFixed(1),
      });

      return res
        .status(416)
        .setHeader("Content-Range", `bytes */${fileLength}`)
        .end();
    }
  } else {
    end = Math.min(end, lastDownloadedByte);
  }

  const chunkSize = end - start + 1;

  if (chunkSize <= 0) {
    return res
      .status(416)
      .setHeader("Content-Range", `bytes */${fileLength}`)
      .end();
  }

  logger.info("Serving range content", {
    range: `${start}-${end}`,
    size: chunkSize,
    file: videoFile.name,
  });

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileLength}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", chunkSize);
  res.setHeader("Content-Type", videoMime);

  const stream = videoFile.createReadStream({ start, end });

  setupStreamHandlers(stream, res, videoFile.name);
  stream.pipe(res);
}

/**
 * Setup stream event handlers
 */
function setupStreamHandlers(stream, res, fileName) {
  stream.on("error", (error) => {
    logger.error("Stream error", { file: fileName, error: error.message });
    if (!res.headersSent) {
      res.status(500).end("Stream error");
    }
  });

  stream.on("end", () => {
    logger.debug("Stream ended", { file: fileName });
  });

  res.on("close", () => {
    logger.debug("Response closed by client", { file: fileName });
    stream.destroy();
  });
}

/**
 * Handle audio track transcoding
 */
async function handleAudioTranscoding(req, res, magnet, audioTrack, startTime) {
  const { torrentService } = await import("../services/torrentService.js");
  const state = await torrentService.getOrAddTorrent(magnet);

  if (!state || !state.videoFile) {
    return res.status(200).send("NOT_READY");
  }

  const videoFile = state.videoFile;
  const MIN_TRANSCODE_BYTES = 1 * 1024 * 1024; // 1MB minimum

  if (videoFile.downloaded < MIN_TRANSCODE_BYTES) {
    logger.info("Insufficient data for transcoding", {
      downloaded: videoFile.downloaded,
      required: MIN_TRANSCODE_BYTES,
    });
    return res.status(200).send("NOT_READY");
  }

  try {
    logger.info("Starting audio transcoding", {
      track: audioTrack,
      startTime: startTime || 0,
      file: videoFile.name,
    });

    // Set headers
    res.setHeader("Content-Type", "video/x-matroska");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Accept-Ranges", "bytes");

    // Create input stream
    const inputStream = videoFile.createReadStream();

    // Create FFmpeg command for lossless remuxing
    const command = ffmpeg()
      .input(inputStream)
      .videoCodec("copy") // Copy video without re-encoding
      .audioCodec("copy") // Copy audio without re-encoding
      .format("matroska")
      .outputOptions([
        "-map",
        "0:v:0", // First video stream
        "-map",
        `0:a:${audioTrack}`, // Selected audio track
        "-avoid_negative_ts",
        "make_zero",
        "-copyts",
        "-start_at_zero",
        "-threads",
        "1",
        "-f",
        "matroska",
      ]);

    // Add start time if specified
    const seekTime = validateSeekTime(startTime);
    if (seekTime > 0) {
      command.seekInput(seekTime);
    }

    // Error handling
    command.on("error", (error) => {
      logger.error("Transcoding error", {
        error: error.message,
        track: audioTrack,
      });

      if (!res.headersSent) {
        res.status(500).send("Audio track switching failed");
      }
    });

    command.on("start", (commandLine) => {
      logger.debug("FFmpeg started", {
        command: commandLine.substring(0, 200),
      });
    });

    command.on("progress", (progress) => {
      if (progress.percent && progress.percent % 10 === 0) {
        logger.debug("Transcoding progress", {
          percent: Math.round(progress.percent),
        });
      }
    });

    command.on("end", () => {
      logger.info("Transcoding completed");
      if (!res.headersSent) {
        res.end();
      }
    });

    // Start streaming
    command.pipe(res, { end: true });
  } catch (error) {
    logger.error("Failed to setup audio transcoding", error);
    if (!res.headersSent) {
      res.status(500).send("Failed to setup audio transcoding");
    }
  }
}

/**
 * Cleanup torrent and files
 */
export const goodbye = asyncHandler(async (req, res) => {
  const magnet = req.query.url || req.body?.url;

  logger.info("Goodbye endpoint called", {
    method: req.method,
    hasMagnet: !!magnet,
  });

  if (!magnet) {
    return res.status(400).json({ error: "Missing magnet URL" });
  }

  const { torrentService } = await import("../services/torrentService.js");
  const torrentPath = await torrentService.destroyTorrent(magnet);

  const response = {
    success: true,
    shouldClearLocalStorage: true,
    magnet,
  };

  if (torrentPath) {
    try {
      const { safeDeleteFile } = await import("../utils/fileUtils.js");
      await safeDeleteFile(torrentPath);

      logger.info("Torrent files deleted", { path: torrentPath });
      response.message = "Torrent destroyed and files deleted";
    } catch (error) {
      logger.error("Failed to delete torrent files", error);
      response.message = "Torrent destroyed, but failed to delete files";
      response.success = false;
    }
  } else {
    logger.info("No files to delete");
    response.message = "Torrent destroyed (no files to delete)";
  }

  res.json(response);
});

/**
 * Clean localStorage for a magnet
 */
export const cleanLocalStorage = asyncHandler(async (req, res) => {
  const magnet = req.query.url || req.body?.url;

  if (!magnet) {
    return res.status(400).json({ error: "Missing magnet URL" });
  }

  logger.info("LocalStorage cleanup requested", {
    magnet: magnet.substring(0, 60),
  });

  res.json({
    success: true,
    magnet,
    message: "LocalStorage cleanup requested",
  });
});
