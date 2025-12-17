// Subtitle streaming controller
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import { getOrAddTorrent } from "../services/torrentService.js";

ffmpeg.setFfmpegPath(ffmpegPath);

// Constants
const FFPROBE_TIMEOUT = 30000; // 30 seconds
const DEFAULT_TRACK_INDEX = 0;

// Endpoint to list all subtitle tracks in the MKV
export async function listSubtitleTracks(req, res) {
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
    // Use the video stream URL instead of file path for WebTorrent
    const videoUrl = `http://localhost:${
      process.env.PORT || 3000
    }/video?url=${encodeURIComponent(magnet)}`;

    const info = await ffprobe(videoUrl, {
      path: ffprobeStatic.path,
      timeout: FFPROBE_TIMEOUT,
    });

    const tracks = info.streams
      .filter((s) => s.codec_type === "subtitle")
      .map((s, i) => ({
        index: i,
        language: s.tags?.language || "und",
        title: s.tags?.title || `Subtitle ${i + 1}`,
        codec: s.codec_name,
      }));

    console.log(`Found ${tracks.length} subtitle tracks:`, tracks);
    res.json(tracks);
  } catch (e) {
    console.error("Failed to probe subtitles:", e.message);
    // Return empty array instead of error to allow graceful fallback
    res.json([]);
  }
}

// Streams ASS/SSA subtitles extracted from MKV video or returns a fallback if not available
export function streamAssSubtitles(req, res) {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).send("Missing url param");
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(200).send("NOT_READY");
    return;
  }
  const videoFile = state.videoFile;
  // If not an MKV file, return a minimal ASS file as fallback
  if (!videoFile.name.endsWith(".mkv")) {
    const emptyAss = `[Script Info]\nTitle: No Subtitles\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,No subtitles available`;
    res.setHeader("Content-Type", "text/x-ssa");
    res.send(emptyAss);
    return;
  }
  res.setHeader("Content-Type", "text/x-ssa");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  let ffmpegCommand = null;
  let hasEnded = false;
  // Helper to send fallback ASS if extraction fails
  const sendFallbackSubtitles = (message = "Subtitle extraction failed") => {
    if (hasEnded) return;
    hasEnded = true;
    const fallbackAss = `[Script Info]\nTitle: ${message}\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,${message}`;
    if (!res.headersSent) {
      res.send(fallbackAss);
    }
  };
  try {
    // Use ffmpeg to extract the selected subtitle stream as ASS from the video
    const trackIndex = req.query.track || DEFAULT_TRACK_INDEX;
    const videoUrl = `http://localhost:${
      process.env.PORT || 3000
    }/video?url=${encodeURIComponent(magnet)}`;
    ffmpegCommand = ffmpeg(videoUrl)
      .inputOptions(["-analyzeduration", "10M", "-probesize", "10M"])
      .outputOptions([`-map 0:s:${trackIndex}?`, "-f ass"])
      .on("error", () => sendFallbackSubtitles("No subtitles found in video"))
      .on("end", () => {
        hasEnded = true;
      });
    // Clean up if client disconnects
    req.on("close", () => {
      hasEnded = true;
      if (ffmpegCommand) ffmpegCommand.kill("SIGTERM");
    });
    ffmpegCommand.pipe(res, { end: true });
  } catch (error) {
    sendFallbackSubtitles("Failed to start subtitle extraction");
  }
}

// Streams VTT subtitles, converting from other formats if needed, or extracts from MKV
export function streamVttSubtitles(req, res) {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).send("Missing url param");
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(200).send("NOT_READY");
    return;
  }
  const torrent = state.torrent;
  let vttFile = null;
  let otherSubFile = null;
  // Try to find a .vtt subtitle file in the torrent
  if (torrent && torrent.files) {
    vttFile = torrent.files.find((f) => f.name.toLowerCase().endsWith(".vtt"));
    if (!vttFile) {
      // Try to find another subtitle file format
      const subExts = [".srt", ".sub", ".ssa", ".txt", ".ass"];
      otherSubFile = torrent.files.find((f) =>
        subExts.some((ext) => f.name.toLowerCase().endsWith(ext))
      );
    }
  }
  if (vttFile) {
    // Stream the VTT file directly
    res.setHeader("Content-Type", "text/vtt");
    const stream = vttFile.createReadStream();
    stream.on("error", () => {
      res.status(500).end("Error streaming VTT subtitle file");
    });
    res.on("close", () => {
      stream.destroy();
    });
    stream.pipe(res);
    return;
  }
  if (otherSubFile) {
    // Convert other subtitle formats to VTT using ffmpeg
    res.setHeader("Content-Type", "text/vtt");
    let ffmpegCommand = null;
    let hasEnded = false;
    const sendFallbackVtt = (message = "Subtitle conversion failed") => {
      if (hasEnded) return;
      hasEnded = true;
      if (!res.headersSent) {
        res.send("WEBVTT\n\nNOTE " + message);
      }
    };
    try {
      const subStream = otherSubFile.createReadStream();
      ffmpegCommand = ffmpeg(subStream)
        .outputOptions(["-f webvtt"])
        .on("error", () => {
          sendFallbackVtt("Subtitle conversion error");
        })
        .on("end", () => {
          hasEnded = true;
        });
      req.on("close", () => {
        hasEnded = true;
        if (ffmpegCommand) ffmpegCommand.kill("SIGTERM");
      });
      ffmpegCommand.pipe(res, { end: true });
    } catch (error) {
      sendFallbackVtt("Failed to start subtitle conversion");
    }
    return;
  }
  const videoFile = state.videoFile;
  // If not an MKV file, return a minimal VTT as fallback
  if (!videoFile.name.endsWith(".mkv")) {
    res.setHeader("Content-Type", "text/vtt");
    res.send("WEBVTT\n\nNOTE No subtitles available");
    return;
  }
  // Extract embedded subtitles from MKV as VTT using ffmpeg
  res.setHeader("Content-Type", "text/vtt");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  let ffmpegCommand = null;
  let hasEnded = false;
  const sendFallbackVtt = (message = "Subtitle extraction failed") => {
    if (hasEnded) return;
    hasEnded = true;
    if (!res.headersSent) {
      res.send("WEBVTT\n\nNOTE " + message);
    }
  };
  try {
    const trackIndex = req.query.track || 0;
    const videoUrl = `http://localhost:${
      process.env.PORT || 3000
    }/video?url=${encodeURIComponent(magnet)}`;
    ffmpegCommand = ffmpeg(videoUrl)
      .inputOptions(["-analyzeduration", "10M", "-probesize", "10M"])
      .outputOptions([`-map 0:s:${trackIndex}?`, "-f webvtt"])
      .on("error", () => {
        sendFallbackVtt("No subtitles found in video");
      })
      .on("end", () => {
        hasEnded = true;
      });
    req.on("close", () => {
      hasEnded = true;
      if (ffmpegCommand) ffmpegCommand.kill("SIGTERM");
    });
    ffmpegCommand.pipe(res, { end: true });
  } catch (error) {
    sendFallbackVtt("Failed to start subtitle extraction");
  }
}
