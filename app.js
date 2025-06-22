import express from "express";
import cors from "cors";
import WebTorrent from "webtorrent";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
ffmpeg.setFfmpegPath(ffmpegPath);

// Enable CORS for all routes
app.use(cors());

// Example route
app.get("/", (_, res) => {
  res.send("Hello from Express with CORS!");
});
// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve index.html as static file
app.use(express.static(__dirname));
const client = new WebTorrent();

// Sintel, a free, Creative Commons movie
const torrentId =
  "magnet:?xt=urn:btih:VFAMDIUUEMCGRYF3ZVODHEOKHHVD6BU4&dn=%5BSubsPlease%5D%20Kimi%20to%20Idol%20Precure%20-%2020%20%281080p%29%20%5BAA5BEB5D%5D.mkv&xl=1484063800&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2F9.rarbg.me%3A2710%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.cyberia.is%3A6969%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker3.itzmx.com%3A6961%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.tiny-vps.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fretracker.lanta-net.ru%3A2710%2Fannounce&tr=http%3A%2F%2Fopen.acgnxtracker.com%3A80%2Fannounce&tr=wss%3A%2F%2Ftracker.openwebtorrent.com";

let videoFile = null;
let videoMime = "video/mp4";

// Add error handler for WebTorrent client
client.on("error", (err) => {
  console.error("WebTorrent client error:", err);
});

client.add(torrentId, function (torrent) {
  console.log("Torrent added successfully:", torrent.name);

  // Add error handler for this specific torrent
  torrent.on("error", (err) => {
    console.error("Torrent error:", err);
  });

  torrent.on("ready", () => {
    console.log("Torrent is ready. Files:");
    torrent.files.forEach((file, index) => {
      console.log(`  ${index}: ${file.name} (${file.length} bytes)`);
    });
  });

  // Find .mp4 or .mkv file
  videoFile = torrent.files.find(function (file) {
    return file.name.endsWith(".mp4") || file.name.endsWith(".mkv");
  });
  if (videoFile) {
    if (videoFile.name.endsWith(".mkv")) {
      videoMime = "video/x-matroska";
    } else {
      videoMime = "video/mp4";
    }
    console.log(`Video file (${videoFile.name}) is ready to stream.`);
  } else {
    console.error("No .mp4 or .mkv file found in torrent.");
    console.log("Available files:");
    torrent.files.forEach((file, index) => {
      console.log(`  ${index}: ${file.name}`);
    });
  }
});

// Expose the file via an Express route, only if ready
app.get("/video", (req, res) => {
  if (!videoFile) {
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }

  const range = req.headers.range;
  const fileLength = videoFile.length;

  let stream;
  if (!range) {
    // No range header, send the whole file
    res.setHeader("Content-Type", videoMime);
    res.setHeader("Content-Length", fileLength);
    stream = videoFile.createReadStream();
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      res.status(500).end("Stream error");
    });
    // Handle client disconnect
    res.on("close", () => {
      stream.destroy();
    });
    stream.pipe(res);
    return;
  }

  // Parse Range header (e.g., 'bytes=0-1023')
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileLength - 1;
  const chunkSize = end - start + 1;

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileLength}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", chunkSize);
  res.setHeader("Content-Type", videoMime);

  stream = videoFile.createReadStream({ start, end });
  stream.on("error", (err) => {
    console.error("Stream error:", err);
    res.status(500).end("Stream error");
  });
  // Handle client disconnect
  res.on("close", () => {
    stream.destroy();
  });
  stream.pipe(res);
});

// Endpoint to extract and stream the first subtitle track as ASS using ffmpeg
app.get("/subtitles", (req, res) => {
  if (!videoFile) {
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }

  console.log("Subtitle request received for file:", videoFile.name);

  // Check if this is an MKV file (more likely to have embedded subs)
  if (!videoFile.name.endsWith(".mkv")) {
    console.log("File is not MKV, sending empty ASS file");
    // Send a minimal ASS file for non-MKV files
    const emptyAss = `[Script Info]
Title: No Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,No subtitles available`;

    res.setHeader("Content-Type", "text/x-ssa");
    res.send(emptyAss);
    return;
  }

  // For MKV files, try to extract subtitles with better error handling
  res.setHeader("Content-Type", "text/x-ssa");

  let ffmpegCommand = null;
  let hasEnded = false;

  const sendFallbackSubtitles = (message = "Subtitle extraction failed") => {
    if (hasEnded) return;
    hasEnded = true;

    const fallbackAss = `[Script Info]
Title: ${message}
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,${message}`;

    if (!res.headersSent) {
      res.send(fallbackAss);
    }
  };

  try {
    // Use the video endpoint URL instead of direct stream to avoid issues
    const videoUrl = `http://localhost:${process.env.PORT || 3000}/video`;

    ffmpegCommand = ffmpeg(videoUrl)
      .inputOptions(["-analyzeduration", "100M", "-probesize", "100M"])
      .outputOptions([
        "-map 0:s:0?", // Map first subtitle stream if it exists, ? makes it optional
        "-f ass", // Output as ASS format
      ])
      .on("start", (commandLine) => {
        console.log("FFmpeg command started:", commandLine);
      })
      .on("stderr", (stderrLine) => {
        // Only log important stderr messages to reduce noise
        if (
          stderrLine.includes("error") ||
          stderrLine.includes("Error") ||
          stderrLine.includes("Stream")
        ) {
          console.log("FFmpeg stderr:", stderrLine);
        }
      })
      .on("error", (err) => {
        console.error("ffmpeg error:", err.message);

        // Don't treat SIGKILL as an error if the client disconnected
        if (err.message.includes("SIGKILL") && hasEnded) {
          console.log("FFmpeg was terminated due to client disconnect");
          return;
        }

        sendFallbackSubtitles("No subtitles found in video");
      })
      .on("end", () => {
        if (!hasEnded) {
          hasEnded = true;
          console.log("FFmpeg subtitle extraction completed successfully");
        }
      });

    // Handle client disconnect
    req.on("close", () => {
      console.log("Client disconnected during subtitle extraction");
      hasEnded = true;
      if (ffmpegCommand) {
        ffmpegCommand.kill("SIGTERM"); // Use SIGTERM first, then SIGKILL if needed
        setTimeout(() => {
          if (ffmpegCommand) {
            ffmpegCommand.kill("SIGKILL");
          }
        }, 5000);
      }
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.log("Subtitle extraction timeout");
      if (ffmpegCommand && !hasEnded) {
        ffmpegCommand.kill("SIGTERM");
        sendFallbackSubtitles("Subtitle extraction timed out");
      }
    }, 30000); // 30 second timeout

    ffmpegCommand.on("end", () => {
      clearTimeout(timeout);
    });

    ffmpegCommand.on("error", () => {
      clearTimeout(timeout);
    });

    // Pipe the output to response
    ffmpegCommand.pipe(res, { end: true });
  } catch (error) {
    console.error("Error setting up FFmpeg:", error);
    sendFallbackSubtitles("Failed to start subtitle extraction");
  }
});

// Serve index.html for / and /index.html
app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
