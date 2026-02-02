// Torrent status controller
import { torrentService } from "../services/torrentService.js";

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Returns the status of a torrent given a magnet link
export async function getStatus(req, res) {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).json({ error: "Missing url param" });

  // Get or add the torrent to the client with error handling
  let state;
  try {
    state = await torrentService.getOrAddTorrent(magnet);
  } catch (error) {
    console.error("Error getting torrent for status:", error.message);
    // Return initializing status instead of 503 error to prevent breaking the frontend
    return res.json({
      status: "initializing",
      progress: 0,
      downloaded: 0,
      downloadSpeed: 0,
      numPeers: 0,
      length: 0,
      message: "Torrent service is initializing...",
    });
  }

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
  // If videoFile exists and has enough data, don't show peer warnings
  if (state.videoFile && state.videoFile.downloaded > 0) {
    if (t.done) {
      status = "done";
    } else {
      // If downloading video file, always show downloading status
      // Don't switch to "no peers" as WebTorrent can temporarily report 0 peers
      status = "downloading";
    }
  } else if (!t.ready && !t.metadata) {
    status = "fetching metadata";
  } else if (t.numPeers === 0 && t.downloaded < 1024 * 1024) {
    // Only show "no peers" if very little downloaded
    status = "no peers";
  } else if (t.downloaded === 0) {
    status = "connecting";
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
    formatBytes, // Pass the function to EJS
  });
}
