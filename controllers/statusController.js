// Torrent status controller
import { getOrAddTorrent } from "../services/torrentService.js";

// Returns the status of a torrent given a magnet link
export function getStatus(req, res) {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).json({ error: "Missing url param" });

  // Get or add the torrent to the client
  const state = getOrAddTorrent(magnet);
  if (!state || !state.torrent) {
    return res.status(404).json({ error: "Torrent not found" });
  }

  // Check if file was deleted externally
  if (state.fileDeleted) {
    return res.json({
      status: "file_deleted",
      fileDeleted: true,
      deletedAt: state.deletedAt,
      error: "File was deleted from disk",
    });
  }

  const t = state.torrent;
  let status = "unknown";
  // Determine torrent status
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
  // Respond with torrent status and stats
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

// Renders system information (memory, CPU, uptime, etc.) to the sysinfo EJS view
export function getSysInfo(req, res) {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  res.render("sysinfo", {
    memory: mem,
    cpu: cpu,
    uptime: process.uptime(),
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
  });
}
