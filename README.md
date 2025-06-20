# WebTnode: Torrent Video Streaming

This project is a Node.js/Express for streaming MKV/MP4 video files directly from torrents. It supports advanced browser-side subtitle rendering.

## Features

- **Stream MKV/MP4 from torrents** using WebTorrent.
- **On-demand subtitle extraction** (ASS/SRT) using ffmpeg.
- **Modern video player UI** with [Plyr](https://github.com/sampotts/plyr).
- **ASS subtitle rendering** in-browser with [SubtitlesOctopus](https://github.com/CCExtractor/SubtitlesOctopus).
- **CORS enabled** for easy local development.

## Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- ffmpeg (bundled via `ffmpeg-static`)

### Installation
1. Clone this repository or copy the project files.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the server:
   ```sh
   node app.js
   ```
4. Open your browser to [http://localhost:3000](http://localhost:3000)

### File Structure
- `app.js` — Express backend, WebTorrent integration, ffmpeg endpoints
- `index.html` — Frontend UI (Plyr, SubtitlesOctopus, track selectors)
- `/libs/` — Static assets for SubtitlesOctopus (JS, fonts)

## Usage
- The server will automatically start downloading a sample torrent (see `torrentId` in `app.js`).
- The browser UI will show a loading screen until the video is ready.
- Subtitles are rendered with full ASS support in the browser.

## Customization
- To use a different torrent, change the `torrentId` in `app.js`.
- Place additional static assets (fonts, JS) in `/libs/` as needed.

## Troubleshooting
- If you see a loading screen for a long time, the torrent may be slow or unavailable.
- If audio/subtitle tracks do not appear, ensure the video file contains them and ffmpeg/ffprobe can access the file.
- For 404 errors on `index.html`, ensure it is in the project root and static serving is set to `__dirname`.

## License
This project is for educational/demo purposes. Video content is streamed from public torrents. Use responsibly.
