import express from "express";
import cors from "cors";
import WebTorrent from "webtorrent";

const app = express();

// Enable CORS for all routes
app.use(cors());

// Example route
app.get("/", (_, res) => {
  res.send("Hello from Express with CORS!");
});

const client = new WebTorrent();

// Sintel, a free, Creative Commons movie
const torrentId =
  "magnet:?xt=urn:btih:ZJA3X5ER3GUSHSUPE3BYMSA5VXTGDWX2&dn=%5BSubsPlease%5D%20Wind%20Breaker%20-%2025%20%281080p%29%20%5BF7089E68%5D.mkv&xl=1447139020&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2F9.rarbg.to%3A2710%2Fannounce&tr=udp%3A%2F%2F9.rarbg.me%3A2710%2Fannounce&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.cyberia.is%3A6969%2Fannounce&tr=udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker3.itzmx.com%3A6961%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.tiny-vps.com%3A6969%2Fannounce&tr=udp%3A%2F%2Fretracker.lanta-net.ru%3A2710%2Fannounce&tr=http%3A%2F%2Fopen.acgnxtracker.com%3A80%2Fannounce&tr=wss%3A%2F%2Ftracker.openwebtorrent.com";

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
