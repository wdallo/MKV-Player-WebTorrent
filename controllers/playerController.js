// Player page controller
export function renderPlayer(req, res) {
  const magnet = req.query.url;
  if (!magnet || !magnet.startsWith("magnet:")) {
    return res.status(400).send("Missing or invalid magnet url param");
  }
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
          // ...existing code for player JS...
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

          video.addEventListener('error', (e) => {
            loading.style.display = 'none';
            errorDiv.textContent = 'Video failed to load or is not playable.';
            errorDiv.style.display = '';
            showStep('Video error event');
            console.error('Video error:', e);
          });

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

          async function pollUntilReady(url, isText) {
            for (let i = 0; i < 120; ++i) {
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
            pollStatus();
            try {
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
              setTimeout(() => {
                if (loading.style.display !== 'none') {
                  loading.style.display = 'none';
                  showStep('Fallback: hiding loading after timeout.');
                  console.warn('Fallback: hiding loading after timeout.');
                }
              }, 2000);
              const player = new Plyr(video, { captions: { active: true, update: true, language: 'en' } });
              if (!ass || ass.indexOf('[Script Info]') === -1) {
                showStep('No valid ASS subtitles found, trying VTT fallback');
                try {
                  const vttUrl = '/subtitles.vtt?url=' + encodeURIComponent(magnet);
                  const vttRes = await fetch(vttUrl);
                  if (vttRes.ok) {
                    const vttText = await vttRes.text();
                    if (vttText && vttText.startsWith('WEBVTT')) {
                      while (video.firstChild) video.removeChild(video.firstChild);
                      const track = document.createElement('track');
                      track.kind = 'subtitles';
                      track.label = 'English';
                      track.srclang = 'en';
                      track.default = true;
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

          window.addEventListener('unload', function() {
            navigator.sendBeacon('/goodbye?url=' + encodeURIComponent(magnet));
          });
        </script>
      </body>
    </html>
  `);
}
