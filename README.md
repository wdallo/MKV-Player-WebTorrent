# MKV-Player-WebTorrent

A modern Node.js/Express app for streaming MKV/MP4 video files directly from torrents, with instant playback, browser-based subtitle rendering, and robust resource management.

## Features

- Stream MKV/MP4 from any torrent magnet using WebTorrent
- Progressive streaming: Video starts as soon as ~256KB is downloaded
- Multi-user, multi-magnet: Each user can stream a different torrent simultaneously
- On-demand subtitle extraction (ASS from MKV, VTT fallback) using ffmpeg
- Modern UI: Plyr video player, real-time status, and progress bar
- Resume playback & start from beginning: Resume where you left off or restart instantly
- ASS subtitle rendering in-browser with SubtitlesOctopus
- Automatic polling/loading: Player appears as soon as enough data is available
- CORS enabled for easy local development
- Instant resource cleanup: Torrents are destroyed when the user closes the browser tab or deletes the file
- Live system info: `/sysinfo` endpoint for real-time Node.js resource stats
- The MKV Player now supports a configurable watermark overlay on the video player.

## Project Structure

```
MKV-Player-WebTorrent/
├── app.js                  # Express backend entrypoint
├── package.json            # Project metadata and dependencies
├── package-lock.json       # Dependency lock file
├── favicon.ico             # App icon
├── .npmrc, .gitignore      # Config files
├── controllers/            # Route handler logic (video, status, subtitles, player)
│   ├── playerController.js
│   ├── statusController.js
│   ├── subtitleController.js
│   └── videoController.js
├── routes/                 # Route definitions for each endpoint
│   ├── playerRoutes.js
│   ├── statusRoutes.js
│   ├── subtitleRoutes.js
│   └── videoRoutes.js
├── services/               # Torrent state and business logic
│   └── torrentService.js
├── libs/                   # Static assets for SubtitlesOctopus (JS, fonts, CSS)
│   ├── player.js           # Main player logic (UI, events, resume, subtitles)
│   ├── style.css           # Custom styles (responsive, overlays)
│   ├── plyr.css            # Plyr video player styles
│   ├── ARIALBD.TTF         # Font for subtitles
│   ├── subtitles-octopus.js
│   ├── subtitles-octopus-worker.js
│   ├── subtitles-octopus-worker-legacy.js
│   └── subtitles-octopus-worker.wasm
├── views/                  # EJS templates for UI and system info
│   ├── player.ejs          # Main player UI
│   └── sysinfo.ejs         # System info dashboard
```

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- ffmpeg (bundled via `ffmpeg-static`)

### Installation

```sh
npm install
node app.js
```

Open your browser to [http://localhost:3000](http://localhost:3000)

## Usage

- To play a torrent, open:
  ```
  http://localhost:3000/player?url=<magnet-link>
  ```
  Replace `<magnet-link>` with your desired magnet URI (URL-encoded).
- The player shows a loading spinner until enough video is downloaded, then begins streaming instantly.
- Subtitles are extracted and rendered automatically if present.
- Use the resume/restart overlay to continue playback or start from the beginning.

## System Info

- Visit `/sysinfo` for a live dashboard of Node.js memory, CPU, and uptime stats.

## Troubleshooting

- SubtitlesOctopus warning: If you see `Browser does not support creating object URLs...`, it is usually harmless and caused by multiple initializations. Ensure SubtitlesOctopus is only initialized once per video load.
- Long loading: Torrent may be slow, have no seeds, or be unavailable. Try another magnet link.
- Video errors: Wait for more data to download, or check if the file is supported by your browser.
- Resource errors: If you see `ERR_INSUFFICIENT_RESOURCES`, lower the WebTorrent `maxConns` setting in `torrentService.js`.

## Customization

- No need to edit `app.js` to change torrents—just use the `?url=` parameter in `/player`.
- Place additional static assets (fonts, JS, CSS) in `/libs/` as needed.

## License

MIT
