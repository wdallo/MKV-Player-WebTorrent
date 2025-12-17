// Audio streaming controller
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import path from "path";
import { getOrAddTorrent } from "../services/torrentService.js";

ffmpeg.setFfmpegPath(ffmpegPath);

// Constants
const MIN_DOWNLOAD_SIZE = 1024 * 1024; // 1MB minimum for analysis/streaming
const FFPROBE_TIMEOUT = 30000; // 30 seconds
const DEFAULT_TRACK_INDEX = 0;

// Endpoint to list all audio tracks in the MKV
export async function listAudioTracks(req, res) {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).send("Missing url param");

  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(200).send("NOT_READY");
    return;
  }
  const videoFile = state.videoFile;

  // If not an MKV file, return empty tracks array
  if (!videoFile.name.endsWith(".mkv")) {
    res.json([]);
    return;
  }

  try {
    // For WebTorrent files, we need to use the download path
    // WebTorrent downloads files to downloads/filename
    const downloadPath = path.join(process.cwd(), "downloads", videoFile.name);

    // Check if enough of the file is downloaded for ffprobe analysis
    if (videoFile.downloaded < MIN_DOWNLOAD_SIZE) {
      res.json([]);
      return;
    }

    // Use the download path for ffprobe analysis
    const info = await ffprobe(downloadPath, {
      path: ffprobeStatic.path,
      timeout: FFPROBE_TIMEOUT,
    });
    const tracks = info.streams
      .filter((s) => s.codec_type === "audio")
      .map((s, i) => ({
        index: i,
        stream_index: s.index,
        language: s.tags?.language || "und",
        title: s.tags?.title || `Track ${i + 1}`,
        codec: s.codec_name,
        channels: s.channels,
        sample_rate: s.sample_rate,
        bit_rate: s.bit_rate,
        default: s.disposition?.default === 1,
        forced: s.disposition?.forced === 1,
      }));

    res.json(tracks);
  } catch (error) {
    console.error("Error analyzing audio tracks:", error);
    res.status(500).json({ error: "Failed to analyze audio tracks" });
  }
}

// Stream specific audio track as WebM/Opus for web compatibility
export function streamAudioTrack(req, res) {
  const magnet = req.query.url;
  const trackIndex = parseInt(req.query.track) || DEFAULT_TRACK_INDEX;

  if (!magnet) return res.status(400).send("Missing url param");

  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(200).send("NOT_READY");
    return;
  }

  const videoFile = state.videoFile;

  // Check if enough of the file is downloaded for streaming
  if (videoFile.downloaded < MIN_DOWNLOAD_SIZE) {
    res.status(200).send("NOT_READY");
    return;
  }

  // Use the download path for ffmpeg
  const downloadPath = path.join(process.cwd(), "downloads", videoFile.name);

  try {
    // Set appropriate headers for audio streaming
    res.setHeader("Content-Type", "audio/webm");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create ffmpeg command to extract and transcode audio track
    const command = ffmpeg(downloadPath)
      .audioCodec("libopus") // Web-compatible audio codec
      .format("webm") // Web-compatible container
      .audioBitrate("128k") // Reasonable quality
      .audioChannels(2) // Stereo output
      .audioFrequency(48000) // Standard sample rate
      .outputOptions([
        "-map",
        `0:a:${trackIndex}`, // Select specific audio track
        "-avoid_negative_ts",
        "make_zero",
        "-fflags",
        "+genpts",
        "-threads",
        "4",
      ]);

    // Handle errors
    command.on("error", (err) => {
      console.error("Audio streaming error:", err);
      if (!res.headersSent) {
        res.status(500).send("Audio streaming failed");
      }
    });

    // Start streaming
    command.pipe(res, { end: true });
  } catch (error) {
    console.error("Error setting up audio stream:", error);
    if (!res.headersSent) {
      res.status(500).send("Failed to stream audio");
    }
  }
}

// Get audio track timing information for synchronization
export async function getAudioTimingOffset(req, res) {
  const magnet = req.query.url;
  const audioTrack = parseInt(req.query.audioTrack) || 0;
  const timePosition = parseFloat(req.query.time) || 0;

  if (!magnet) return res.status(400).send("Missing url param");

  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    return res.status(200).send("NOT_READY");
  }

  const videoFile = state.videoFile;

  // Check if enough of the file is downloaded for analysis
  if (videoFile.downloaded < 1024 * 1024) {
    // Need at least 1MB
    return res.status(200).send("NOT_READY");
  }

  try {
    // Use the download path for ffprobe
    const downloadPath = path.join(process.cwd(), "downloads", videoFile.name);

    const info = await ffprobe(downloadPath, {
      path: ffprobeStatic.path,
      timeout: 30000,
    });

    // Find the specific audio track
    const audioStreams = info.streams.filter((s) => s.codec_type === "audio");
    const targetAudioStream = audioStreams[audioTrack];

    if (!targetAudioStream) {
      return res.status(404).json({ error: "Audio track not found" });
    }

    // Calculate timing offset based on stream start time
    const startTime = parseFloat(targetAudioStream.start_time) || 0;
    const adjustedTime = Math.max(0, timePosition - startTime);

    res.json({
      originalTime: timePosition,
      adjustedTime: adjustedTime,
      startTime: startTime,
      audioTrackIndex: audioTrack,
      confidence: startTime !== 0 ? "high" : "medium",
    });
  } catch (error) {
    console.error("Error getting audio timing:", error);
    res.status(500).json({
      error: "Failed to get audio timing",
      originalTime: timePosition,
      adjustedTime: timePosition,
      confidence: "low",
    });
  }
}
