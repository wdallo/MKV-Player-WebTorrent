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

// --- MULTI-MAGNET STATE ---
const torrents = {}; // magnet -> { torrent, videoFile, videoMime, lastAccess }

function getOrAddTorrent(magnet, cb) {
  if (!magnet || !magnet.startsWith("magnet:")) return null;
  if (torrents[magnet]) {
    // Always re-select the first 1MB for streaming, even after refresh
    const videoFile = torrents[magnet].videoFile;
    if (videoFile) {
      const end = Math.min(videoFile.length - 1, 1 * 1024 * 1024 - 1);
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
    // Prioritize downloading the first 1MB for streaming
    if (videoFile) {
      const end = Math.min(videoFile.length - 1, 1 * 1024 * 1024 - 1);
      videoFile.select(0, end, false);
    }
    torrents[magnet].lastAccess = Date.now();
    if (cb) cb(torrent);
  });
  return torrents[magnet];
}

// --- NEW: Torrent status endpoint ---
app.get("/status", (req, res) => {
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
});

// Example route
// Route to get a simple player page, with video source set via query param (?src=/video)
app.get("/player", (req, res) => {
  const magnet = req.query.url;
  if (!magnet || !magnet.startsWith("magnet:")) {
    return res.status(400).send("Missing or invalid magnet url param");
  }
  // The video and subtitle endpoints will use the same ?url= param
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Video Player</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css" />
        <style>
          body { background: #181818; color: #fff; }
          .plyr { margin: 40px auto; max-width: 800px; }
          #loading { text-align: center; margin-top: 100px; font-size: 1.5em; }
          #error { color: #ff5555; text-align: center; margin-top: 40px; }
        </style>
        <script src="/libs/subtitles-octopus.js"></script>
      </head>
      <body>
        <div id="loading">Loading video and subtitles, please wait...</div>
        <div id="status-msg" style="text-align:center; margin-top:10px; color:#aaa;"></div>
        <div id="error" style="display:none"></div>
        <video id="player" controls crossorigin playsinline width="800" style="background:#000; display:none;"></video>
        <script src="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.polyfilled.js"></script>
        <script>
          // DOM debug helpers
          function showStep(msg) {
            let step = document.getElementById('step-debug');
            if (!step) {
              step = document.createElement('div');
              step.id = 'step-debug';
              step.style = 'color:yellow; background:#222; padding:8px; margin:10px 0; text-align:center;';
              document.body.insertBefore(step, document.body.firstChild);
            }
            step.textContent = msg;
          }
          showStep('JS loaded');

          const magnet = ${JSON.stringify(magnet)};
          const video = document.getElementById('player');
          const loading = document.getElementById('loading');
          const errorDiv = document.getElementById('error');
          const statusMsg = document.getElementById('status-msg');

          // Show error if video fails to play
          video.addEventListener('error', (e) => {
            loading.style.display = 'none';
            errorDiv.textContent = 'Video failed to load or is not playable.';
            errorDiv.style.display = '';
            showStep('Video error event');
            console.error('Video error:', e);
          });

          // Hide loading when video is ready
          video.addEventListener('canplay', () => {
            loading.style.display = 'none';
            video.style.display = '';
            showStep('Video canplay event');
            console.log('Video can play.');
          });
          video.addEventListener('loadeddata', () => {
            loading.style.display = 'none';
            video.style.display = '';
            showStep('Video loadeddata event');
            console.log('Video loaded data.');
          });

          // --- New: Poll /status for real-time torrent info ---
          let lastStatus = '';
          let noPeersSince = null;
          let statusPollerActive = true;
          async function pollStatus() {
            while (statusPollerActive && loading.style.display !== 'none') {
              try {
                const res = await fetch('/status?url=' + encodeURIComponent(magnet));
                if (res.ok) {
                  const data = await res.json();
                  let msg = '';
                  if (data.status === 'fetching metadata') {
                    msg = 'Fetching torrent metadata...';
                  } else if (data.status === 'no peers') {
                    msg = 'No seeds/peers found. Waiting...';
                    if (!noPeersSince) noPeersSince = Date.now();
                  } else if (data.status === 'connecting') {
                    msg = 'Connecting to peers...';
                  } else if (data.status === 'downloading') {
                    var pct = (data.progress * 100).toFixed(1);
                    var speed = (data.downloadSpeed / 1024).toFixed(1);
                    msg = 'Downloading: ' + pct + '% at ' + speed + ' KB/s (' + data.numPeers + ' peers)';
                    noPeersSince = null;
                  } else if (data.status === 'done') {
                    msg = 'Download complete!';
                    noPeersSince = null;
                  } else {
                    msg = 'Status: ' + data.status;
                  }
                  // If stuck with no peers for >20s, show warning
                  if (data.status === 'no peers' && noPeersSince && Date.now() - noPeersSince > 20000) {
                    msg += ' <span style="color:#ff5555">No seeds found or torrent stalled. Try another torrent.</span>';
                  }
                  statusMsg.innerHTML = msg;
                  lastStatus = data.status;
                } else {
                  statusMsg.textContent = 'Waiting for torrent status...';
                }
              } catch (e) {
                statusMsg.textContent = 'Error fetching torrent status.';
              }
              await new Promise(r => setTimeout(r, 1000));
            }
          }

          // Poll for video/subtitles readiness
          async function pollUntilReady(url, isText) {
            for (let i = 0; i < 120; ++i) { // up to ~60s
              try {
                const res = await fetch(url, { method: 'GET' });
                if (res.status === 200) {
                  return isText ? await res.text() : url;
                }
              } catch (e) {}
              await new Promise(r => setTimeout(r, 500));
            }
            throw new Error('Timeout waiting for ' + url);
          }

          async function startPlayer() {
            showStep('startPlayer() called');
            statusPollerActive = true;
            pollStatus(); // Start status polling
            try {
              // Wait for video and subtitles to be ready
              const videoUrl = '/video?url=' + encodeURIComponent(magnet);
              const subtitlesUrl = '/subtitles?url=' + encodeURIComponent(magnet);
              const [videoSrc, ass] = await Promise.all([
                pollUntilReady(videoUrl, false),
                pollUntilReady(subtitlesUrl, true)
              ]);
              showStep('Video and subtitles are ready');
              console.log('Video and subtitles are ready.');
              video.src = videoSrc;
              video.style.display = '';
              video.load();
              // Fallback: hide loading after 2s if video events don't fire
              setTimeout(() => {
                if (loading.style.display !== 'none') {
                  loading.style.display = 'none';
                  showStep('Fallback: hiding loading after timeout.');
                  console.warn('Fallback: hiding loading after timeout.');
                }
              }, 2000);
              const player = new Plyr(video, { captions: { active: true, update: true, language: 'en' } });
              if (!ass || ass.indexOf('[Script Info]') === -1) {
                // Try VTT fallback
                showStep('No valid ASS subtitles found, trying VTT fallback');
                try {
                  const vttUrl = '/subtitles.vtt?url=' + encodeURIComponent(magnet);
                  const vttRes = await fetch(vttUrl);
                  if (vttRes.ok) {
                    const vttText = await vttRes.text();
                    if (vttText && vttText.startsWith('WEBVTT')) {
                      // Remove any previous tracks
                      while (video.firstChild) video.removeChild(video.firstChild);
                      const track = document.createElement('track');
                      track.kind = 'subtitles';
                      track.label = 'English';
                      track.srclang = 'en';
                      track.default = true;
                      // Create a Blob URL for the VTT
                      const vttBlob = new Blob([vttText], { type: 'text/vtt' });
                      track.src = URL.createObjectURL(vttBlob);
                      video.appendChild(track);
                      errorDiv.textContent = 'No valid ASS subtitles found. Using VTT fallback.';
                      errorDiv.style.display = '';
                      showStep('VTT fallback loaded');
                    } else {
                      errorDiv.textContent = 'No valid ASS or VTT subtitles found.';
                      errorDiv.style.display = '';
                      showStep('No valid ASS or VTT subtitles found');
                    }
                  } else {
                    errorDiv.textContent = 'No valid ASS or VTT subtitles found.';
                    errorDiv.style.display = '';
                    showStep('No valid ASS or VTT subtitles found');
                  }
                } catch (e) {
                  errorDiv.textContent = 'No valid ASS or VTT subtitles found.';
                  errorDiv.style.display = '';
                  showStep('No valid ASS or VTT subtitles found');
                }
                statusPollerActive = false;
                return;
              }
              if (typeof window.SubtitlesOctopus === 'undefined') {
                errorDiv.textContent = 'SubtitlesOctopus not loaded!';
                errorDiv.style.display = '';
                showStep('SubtitlesOctopus not loaded');
                statusPollerActive = false;
                return;
              }
              window.octopus = new window.SubtitlesOctopus({
                video: video,
                subContent: ass,
                workerUrl: '/libs/subtitles-octopus-worker.js',
                fonts: [],
                fallbackFont: '/libs/ARIALBD.TTF',
                renderMode: 'wasm-blend',
                targetFps: 24
              });
              showStep('SubtitlesOctopus initialized');
              console.log('SubtitlesOctopus initialized.');
              statusPollerActive = false;
              statusMsg.innerHTML = '';
            } catch (err) {
              loading.style.display = 'none';
              errorDiv.textContent = 'Failed to load video or subtitles: ' + err.message;
              errorDiv.style.display = '';
              showStep('Player error: ' + err.message);
              console.error('Player error:', err);
              statusPollerActive = false;
            }
          }
          startPlayer();

          // Notify backend to destroy torrent on page close
          window.addEventListener('unload', function() {
            navigator.sendBeacon('/goodbye?url=' + encodeURIComponent(magnet));
          });
        </script>
      </body>
    </html>
  `);
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
  const magnet = req.query.url;
  if (!magnet) return res.status(400).send("Missing url param");
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }
  const videoFile = state.videoFile;
  const videoMime = state.videoMime;
  // Wait for at least 1MB to be downloaded before serving
  const MIN_READY_BYTES = 1024 * 1024; // 1MB
  if (videoFile.downloaded < MIN_READY_BYTES) {
    console.log(
      `[VIDEO] Not enough data: downloaded=${videoFile.downloaded} bytes, need at least ${MIN_READY_BYTES} bytes for ${videoFile.name}`
    );
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }
  const range = req.headers.range;
  const fileLength = videoFile.length;
  let stream;
  if (!range) {
    res.setHeader("Content-Type", videoMime);
    res.setHeader("Content-Length", fileLength);
    stream = videoFile.createReadStream();
    stream.on("error", (err) => {
      console.error("Stream error:", err);
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
  res.on("close", () => {
    stream.destroy();
  });
  stream.pipe(res);
});

// Endpoint to extract and stream the first subtitle track as ASS using ffmpeg
app.get("/subtitles", (req, res) => {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).send("Missing url param");
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }
  const videoFile = state.videoFile;
  if (!videoFile.name.endsWith(".mkv")) {
    const emptyAss = `[Script Info]\nTitle: No Subtitles\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,No subtitles available`;
    res.setHeader("Content-Type", "text/x-ssa");
    res.send(emptyAss);
    return;
  }
  res.setHeader("Content-Type", "text/x-ssa");
  let ffmpegCommand = null;
  let hasEnded = false;
  const sendFallbackSubtitles = (message = "Subtitle extraction failed") => {
    if (hasEnded) return;
    hasEnded = true;
    const fallbackAss = `[Script Info]\nTitle: ${message}\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,${message}`;
    if (!res.headersSent) {
      res.send(fallbackAss);
    }
  };
  try {
    const videoUrl = `http://localhost:${
      process.env.PORT || 3000
    }/video?url=${encodeURIComponent(magnet)}`;
    ffmpegCommand = ffmpeg(videoUrl)
      .inputOptions(["-analyzeduration", "100M", "-probesize", "100M"])
      .outputOptions(["-map 0:s:0?", "-f ass"])
      .on("error", (err) => {
        sendFallbackSubtitles("No subtitles found in video");
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
    sendFallbackSubtitles("Failed to start subtitle extraction");
  }
});

// Endpoint to extract and stream the first subtitle track as VTT using ffmpeg or serve .vtt file directly from torrent or convert other subtitle formats
app.get("/subtitles.vtt", (req, res) => {
  const magnet = req.query.url;
  if (!magnet) return res.status(400).send("Missing url param");
  const state = getOrAddTorrent(magnet);
  if (!state || !state.videoFile) {
    res.status(503).send("Video is not ready yet. Please try again later.");
    return;
  }
  const torrent = state.torrent;
  // Try to find a .vtt file in the torrent
  let vttFile = null;
  let otherSubFile = null;
  if (torrent && torrent.files) {
    vttFile = torrent.files.find((f) => f.name.toLowerCase().endsWith(".vtt"));
    if (!vttFile) {
      // Look for other subtitle formats (srt, sub, ssa, txt, ass)
      const subExts = [".srt", ".sub", ".ssa", ".txt", ".ass"];
      otherSubFile = torrent.files.find((f) =>
        subExts.some((ext) => f.name.toLowerCase().endsWith(ext))
      );
    }
  }
  if (vttFile) {
    res.setHeader("Content-Type", "text/vtt");
    const stream = vttFile.createReadStream();
    stream.on("error", (err) => {
      res.status(500).end("Error streaming VTT subtitle file");
    });
    res.on("close", () => {
      stream.destroy();
    });
    stream.pipe(res);
    return;
  }
  if (otherSubFile) {
    // Convert to VTT using ffmpeg
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
      // Create a stream from the subtitle file
      const subStream = otherSubFile.createReadStream();
      ffmpegCommand = ffmpeg(subStream)
        .inputFormat(null) // Let ffmpeg auto-detect
        .outputOptions(["-f webvtt"])
        .on("error", (err) => {
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
  // If no .vtt or other subtitle file, try ffmpeg extraction from first subtitle track in video
  const videoFile = state.videoFile;
  if (!videoFile.name.endsWith(".mkv")) {
    // No VTT for non-mkv
    res.setHeader("Content-Type", "text/vtt");
    res.send("WEBVTT\n\nNOTE No subtitles available");
    return;
  }
  res.setHeader("Content-Type", "text/vtt");
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
    const videoUrl = `http://localhost:${
      process.env.PORT || 3000
    }/video?url=${encodeURIComponent(magnet)}`;
    ffmpegCommand = ffmpeg(videoUrl)
      .inputOptions(["-analyzeduration", "100M", "-probesize", "100M"])
      .outputOptions(["-map 0:s:0?", "-f webvtt"])
      .on("error", (err) => {
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
});

// --- Destroy torrent on explicit goodbye ---
app.get("/goodbye", (req, res) => {
  const magnet = req.query.url;
  if (!magnet || !torrents[magnet])
    return res.status(200).send("No such torrent");
  const state = torrents[magnet];
  if (state.torrent) {
    console.log(`[GOODBYE] Destroying torrent: ${magnet}`);
    state.torrent.destroy();
  }
  delete torrents[magnet];
  res.status(200).send("Torrent destroyed");
});

// Serve index.html for / and /index.html
app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
