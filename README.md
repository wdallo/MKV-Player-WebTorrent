# MKV/MP4 WebTorrent Streaming Player

A Node.js/Express server for streaming MKV/MP4 video files directly from torrents, supporting robust multi-user, multi-magnet streaming, advanced browser-side subtitle rendering, and instant resource cleanup.

## Features

- **Stream MKV/MP4 from any torrent magnet** using WebTorrent.
- **Multi-user, multi-magnet:** Each user can load and stream a different torrent simultaneously.
- **On-demand subtitle extraction** (ASS from MKV, VTT fallback) using ffmpeg.
- **Modern video player UI** with [Plyr](https://github.com/sampotts/plyr).
- **ASS subtitle rendering** in-browser with [SubtitlesOctopus](https://github.com/CCExtractor/SubtitlesOctopus), with VTT fallback.
- **Automatic polling/loading:** Player shows as soon as 1MB is downloaded, with real-time torrent status and robust error feedback.
- **CORS enabled** for easy local development.
- **Instant resource cleanup:** Torrents are destroyed immediately when the user closes the browser tab.

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

- `app.js` — Express backend, WebTorrent integration, ffmpeg endpoints, multi-magnet logic, instant cleanup
- `index.html` — (Optional) Static entry point
- `/libs/` — Static assets for SubtitlesOctopus (JS, fonts)

## Usage

- To play a torrent, open:
  ```
  http://localhost:3000/player?url=<magnet-link>
  ```
  Replace `<magnet-link>` with your desired magnet URI (URL-encoded).
- The player will show a loading screen until at least 1MB of video is downloaded, then the player appears and begins streaming.
- Subtitles are rendered with full ASS support in the browser, with automatic VTT fallback if needed.
- Real-time torrent status and error messages are shown in the player UI.

## Customization

- No need to edit `app.js` to change torrents—just use the `?url=` parameter in `/player`.
- Place additional static assets (fonts, JS) in `/libs/` as needed.

## Troubleshooting

- If you see a loading screen for a long time, the torrent may be slow, have no seeds, or be unavailable.
- If you see video errors, the file may not be fully downloaded or playable yet. Wait and reload.
- For 404 errors on static assets, ensure they are in the correct location and static serving is set to `__dirname`.

## License

This project is for educational/demo purposes. Video content is streamed from public torrents. Use responsibly.
