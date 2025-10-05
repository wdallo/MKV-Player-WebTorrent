// Torrent logic and state management

import WebTorrent from "webtorrent";

const client = new WebTorrent();
const torrents = {}; // magnet -> { torrent, videoFile, videoMime, lastAccess }

function getOrAddTorrent(magnet, cb) {
  if (!magnet || !magnet.startsWith("magnet:")) return null;
  if (torrents[magnet]) {
    const videoFile = torrents[magnet].videoFile;
    if (videoFile) {
      // Select the first 5MB for streaming
      const end = Math.min(videoFile.length - 1, 5 * 1024 * 1024 - 1);
      videoFile.select(0, end, false);
    }
    torrents[magnet].lastAccess = Date.now();
    if (cb) cb(torrents[magnet].torrent);
    return torrents[magnet];
  }
  torrents[magnet] = {
    torrent: null,
    videoFile: null,
    videoMime: "video/mp4",
    lastAccess: Date.now(),
  };
  torrents[magnet].torrent = client.add(magnet, (torrent) => {
    const videoFile = torrent.files.find(
      (f) => f.name.endsWith(".mp4") || f.name.endsWith(".mkv")
    );
    torrents[magnet].videoFile = videoFile;
    torrents[magnet].videoMime =
      videoFile && videoFile.name.endsWith(".mkv")
        ? "video/x-matroska"
        : "video/mp4";
    if (videoFile) {
      // Select the first 5MB for streaming
      const end = Math.min(videoFile.length - 1, 5 * 1024 * 1024 - 1);
      videoFile.select(0, end, false);
    }
    torrents[magnet].lastAccess = Date.now();
    if (cb) cb(torrent);
  });
  return torrents[magnet];
}

function destroyTorrent(magnet) {
  if (!magnet || !torrents[magnet]) return;
  const state = torrents[magnet];
  if (state.torrent) state.torrent.destroy();
  delete torrents[magnet];
}

export { client, torrents, getOrAddTorrent, destroyTorrent };
