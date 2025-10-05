// Torrent status controller
import { getOrAddTorrent } from "../services/torrentService.js";

export function getStatus(req, res) {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).json({ error: "Missing url param" });
  const state = getOrAddTorrent(magnet);
  if (!state || !state.torrent) {
    return res.status(404).json({ error: "Torrent not found" });
  }
  const t = state.torrent;
  let status = "unknown";
  if (!t.metadata) {
    status = "fetching metadata";
  } else if (t.numPeers === 0) {
    status = "no peers";
  } else if (t.downloaded === 0) {
    status = "connecting";
  } else if (t.done) {
    status = "done";
  } else {
    status = "downloading";
  }
  res.json({
    status,
    infoHash: t.infoHash,
    name: t.name,
    ready: !!state.videoFile && state.videoFile.downloaded > 0,
    downloaded: t.downloaded,
    length: t.length,
    progress: t.progress,
    numPeers: t.numPeers,
    timeRemaining: t.timeRemaining,
    received: t.received,
    downloadSpeed: t.downloadSpeed,
    uploadSpeed: t.uploadSpeed,
    error: t.error ? t.error.message : undefined,
  });
}
