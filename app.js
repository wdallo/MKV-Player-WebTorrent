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
  "magnet:?xt=urn:btih:VBDXSZUYQBRADVFLWOFX3NNOVPVCKEAC&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&dn=%5BYameii%5D%20Our%20Last%20Crusade%20or%20the%20Rise%20of%20a%20New%20World%20-%20S02E09%20%5BEnglish%20Dub%5D%20%5BCR%20WEB-DL%201080p%5D%20%5BA68D1C3C%5D%20%28Kimi%20to%20Boku%20no%20Saigo%20no%20Senjou%2C%20Arui%20wa%20Sekai%20ga%20Hajimaru%20Seisen%20Season%20II%20%7C%20S2%29";

let videoFile = null;
let videoMime = "video/mp4";

client.add(torrentId, function (torrent) {
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
  // Serve the video file as a local HTTP URL for ffmpeg
  // We'll use a local file path since the file is available via WebTorrent
  // If you want to use a remote URL, replace with the actual URL
  const mkvPath = "http://localhost:3000/video";
  res.setHeader("Content-Type", "text/x-ssa");
  ffmpeg(mkvPath)
    .outputOptions(["-map 0:s:0"])
    .format("ass")
    .on("error", (err) => {
      console.error("ffmpeg error:", err);
      res.status(500).end("Subtitle extraction error");
    })
    .pipe(res, { end: true });
});

// Serve index.html for / and /index.html
app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
