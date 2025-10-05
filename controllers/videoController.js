// Video streaming controller
import { getOrAddTorrent } from "../services/torrentService.js";

const MIN_READY_BYTES = 5 * 1024 * 1024; // 5MB

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
  const firstPiece = videoFile._startPiece || 0;
  const firstPieceDownloaded =
    videoFile._torrent && videoFile._torrent.bitfield
      ? videoFile._torrent.bitfield.get(firstPiece)
      : false;
  // If more than 1MB is downloaded (e.g. after refresh), allow streaming regardless of first piece
  if (videoFile.downloaded >= 1024 * 1024) {
    console.log(
      `[VIDEO] Allowing stream: downloaded=${videoFile.downloaded} bytes (>1MB)`
    );
  } else if (videoFile.downloaded < MIN_READY_BYTES || !firstPieceDownloaded) {
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
  if (!range) {
    console.log(
      `[VIDEO] No range header. Sending full file: ${videoFile.name} (${fileLength} bytes)`
    );
    res.setHeader("Content-Type", videoMime);
    res.setHeader("Content-Length", fileLength);
    stream = videoFile.createReadStream();
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
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileLength - 1;
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
  stream.on("error", (err) => {
    console.error("[VIDEO] Stream error (range):", err);
    res.status(500).end("Stream error");
  });
  res.on("close", () => {
    stream.destroy();
  });
  stream.pipe(res);
}
