# MKV Player WebTorrent

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

> A modern, feature-rich Node.js application for streaming MKV/MP4 video files directly from BitTorrent magnets with instant playback, advanced subtitle support, and intelligent resource management.

## ✨ Key Features

### 🎬 **Advanced Video Streaming**

- **Instant Playback**: Stream starts as soon as ~256KB is downloaded
- **Progressive Loading**: No need to wait for complete downloads
- **Multi-format Support**: MKV, MP4, and other common video formats
- **Quality Detection**: Automatic video resolution display (480p, 720p, 1080p, etc.)

### 🎭 **Professional Subtitle System**

- **Multi-track Support**: Switch between multiple subtitle tracks
- **ASS/SSA Rendering**: Advanced subtitle formatting with SubtitlesOctopus
- **Real-time Extraction**: On-demand subtitle extraction from MKV files
- **Custom UI**: Plyr-styled subtitle selector with smooth animations
- **VTT Fallback**: Support for standard WebVTT subtitles

### 🎮 **Modern Player Interface**

- **Plyr Integration**: Beautiful, responsive video player
- **Custom Controls**: CC button, quality indicator, and fullscreen support
- **Resume Functionality**: Continue where you left off or restart from beginning
- **Loading Overlays**: Smooth transitions with blur effects during subtitle changes
- **Fullscreen Ready**: All overlays and controls work seamlessly in fullscreen

### 🚀 **Performance & Scalability**

- **Multi-user Support**: Each user can stream different torrents simultaneously
- **WebTorrent Powered**: Efficient P2P streaming technology
- **Resource Management**: Intelligent cleanup and memory optimization
- **Cross-tab Sync**: Synchronized state across multiple browser tabs

### 🛠 **Developer Experience**

- **Live System Monitoring**: Real-time Node.js resource stats at `/sysinfo`
- **Comprehensive Logging**: Detailed debug information and error tracking
- **Configurable Settings**: Extensive configuration options via `CONFIG` object
- **API Endpoints**: RESTful API for status, subtitles, and video streaming

## 🏗 Architecture Overview

### Project Structure

```
MKV-Player-WebTorrent/
├── 📁 app.js                     # Express server & middleware setup
├── 📁 package.json               # Dependencies & scripts
├── 📁 package-lock.json          # Dependency lock file
├── 📁 favicon.ico                # Application icon
├── 📁 .npmrc, .gitignore         # Configuration files
│
├── 📂 controllers/               # Business logic controllers
│   ├── playerController.js      # Player page rendering & config
│   ├── statusController.js      # Torrent status & progress API
│   ├── subtitleController.js    # Subtitle extraction & streaming
│   └── videoController.js       # Video streaming & file serving
│
├── 📂 routes/                    # Express route definitions
│   ├── playerRoutes.js          # /player endpoint
│   ├── statusRoutes.js          # /status, /goodbye endpoints
│   ├── subtitleRoutes.js        # /subtitles, /subtitle-tracks endpoints
│   └── videoRoutes.js           # /video endpoint
│
├── 📂 services/                  # Core business services
│   └── torrentService.js        # WebTorrent management & lifecycle
│
├── 📂 libs/                      # Frontend assets & libraries
│   ├── player.js                # Main player application (2000+ lines)
│   ├── style.css                # Custom UI styles & responsive design
│   ├── plyr.css                 # Plyr video player styles
│   ├── ARIALBD.TTF              # Primary subtitle font
│   ├── NotoSansJP-Bold.ttf      # Japanese subtitle font
│   ├── subtitles-octopus.js     # ASS/SSA subtitle renderer
│   ├── subtitles-octopus-worker.js
│   ├── subtitles-octopus-worker-legacy.js
│   └── subtitles-octopus-worker.wasm
│
├── 📂 views/                     # EJS template files
│   ├── index.ejs                # Home page with magnet input
│   ├── player.ejs               # Main video player interface
│   └── sysinfo.ejs              # System monitoring dashboard
│
└── 📂 downloads/                 # Temporary torrent file storage
```

### Technology Stack

| Component            | Technology        | Purpose                                  |
| -------------------- | ----------------- | ---------------------------------------- |
| **Backend**          | Node.js + Express | HTTP server & API endpoints              |
| **Streaming**        | WebTorrent        | P2P video streaming                      |
| **Video Processing** | FFmpeg            | Subtitle extraction & video analysis     |
| **Frontend**         | Vanilla JS + EJS  | Responsive UI without framework overhead |
| **Video Player**     | Plyr              | Modern HTML5 video player                |
| **Subtitles**        | SubtitlesOctopus  | Advanced ASS/SSA subtitle rendering      |

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16.0.0 or higher) - [Download here](https://nodejs.org/)
- **Git** (optional) - For cloning the repository

> **Note**: FFmpeg is automatically installed via `ffmpeg-static` package

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/wdallo/MKV-Player-WebTorrent.git
   cd MKV-Player-WebTorrent
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   # or
   node app.js
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Usage Guide

### Basic Usage

1. **Home Page**: Navigate to `http://localhost:3000`
2. **Paste Magnet Link**: Enter any BitTorrent magnet URL
3. **Start Streaming**: Click "Stream Video" to begin playback

### Direct URL Access

Stream any torrent directly using URL parameters:

```
http://localhost:3000/player?url=<magnet-link>
```

**Example:**

```
http://localhost:3000/player?url=magnet%3A%3Fxt%3Durn%3Abtih%3A...
```

> **Tip**: Make sure to URL-encode the magnet link for proper parsing

### Player Controls

| Control               | Function                          |
| --------------------- | --------------------------------- |
| **Play/Pause**        | Standard video playback control   |
| **Progress Bar**      | Seek to any position in the video |
| **Volume**            | Audio level control               |
| **CC Button**         | Open subtitle track selector      |
| **Quality Indicator** | Displays video resolution         |
| **Settings**          | Plyr player options               |
| **Fullscreen**        | Expand to full screen mode        |

### Subtitle Management

- **Automatic Detection**: Subtitles are extracted automatically from MKV files
- **Multi-track Support**: Switch between different language tracks
- **Real-time Loading**: Subtitles load progressively as they become available
- **Custom Styling**: Advanced formatting support with ASS/SSA rendering

### Resume Functionality

- **Auto-save**: Playback position is saved automatically
- **Resume Overlay**: Shows when returning to a partially watched video
- **Manual Control**: Choose to resume or restart from beginning

## ⚙️ Configuration

The application uses a comprehensive configuration system located in `libs/player.js`:

### Core Settings

```javascript
const CONFIG = {
  MAX_RETRIES: 20, // Max retry attempts before continuous retry
  BASE_RETRY_DELAY: 2000, // Initial retry delay (ms)
  MAX_RETRY_DELAY: 10000, // Maximum retry delay (ms)
  CONTINUOUS_RETRY_INTERVAL: 30000, // Continuous retry interval (ms)
  STATUS_POLL_INTERVAL: 1000, // Status polling frequency (ms)
  READY_THRESHOLD: 256 * 1024, // Bytes needed before playback (256KB)
  RESOURCE_TIMEOUT: 300, // Resource loading timeout (polling attempts)
  STALL_TIMEOUT: 20000, // Torrent stall detection (ms)
  WATERMARK: false, // Show/hide watermark overlay
  WATERMARK_CONTENT: "Demo", // Watermark text content
  MANUAL_CLEANUP: false, // Enable immediate cleanup on page close
  AUTO_DELETE_HOURS: 72, // Auto-delete unused torrents (hours)
};
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000                    # Server port (default: 3000)
NODE_ENV=development         # Environment mode
DEBUG=true                   # Enable debug logging

```

### Customization Options

#### Watermark Configuration

```javascript
// Enable watermark
CONFIG.WATERMARK = true;
CONFIG.WATERMARK_CONTENT = "Your Brand Name";
```

#### Cleanup Behavior

```javascript
// Enable manual cleanup (files deleted when tab closes)
CONFIG.MANUAL_CLEANUP = true;

// Or use automatic cleanup (files deleted after X hours)
CONFIG.AUTO_DELETE_HOURS = 24;
```

#### Performance Tuning

```javascript
// Faster startup (lower quality threshold)
CONFIG.READY_THRESHOLD = 128 * 1024; // 128KB

// More stable connections (higher retry limits)
CONFIG.MAX_RETRIES = 50;
CONFIG.MAX_RETRY_DELAY = 30000;
```

## 🔌 API Reference

### Video Streaming

**GET** `/video?url=<magnet>`

- **Description**: Stream video content from torrent
- **Parameters**:
  - `url` (required): URL-encoded magnet link
- **Response**: Video stream (HTTP 206 for range requests)

### Subtitle Management

**GET** `/subtitles?url=<magnet>&track=<n>`

- **Description**: Extract and serve subtitle track
- **Parameters**:
  - `url` (required): URL-encoded magnet link
  - `track` (optional): Track index (default: 0)
- **Response**: ASS/SSA or VTT subtitle content

**GET** `/subtitle-tracks?url=<magnet>`

- **Description**: List available subtitle tracks
- **Response**: JSON array of track information

```json
[
  { "language": "eng", "title": "English" },
  { "language": "jpn", "title": "Japanese" }
]
```

### Status & Monitoring

**GET** `/status?url=<magnet>`

- **Description**: Get torrent download status
- **Response**: JSON status object

```json
{
  "status": "downloading",
  "progress": 0.45,
  "downloadSpeed": 1024000,
  "downloaded": 45670400,
  "length": 101376000,
  "numPeers": 12
}
```

**GET** `/sysinfo`

- **Description**: System resource monitoring
- **Response**: HTML dashboard with real-time stats

**POST** `/goodbye?url=<magnet>`

- **Description**: Cleanup torrent resources
- **Response**: JSON cleanup confirmation

### Player Interface

**GET** `/player?url=<magnet>`

- **Description**: Main player interface
- **Response**: HTML player page

**GET** `/`

- **Description**: Home page with magnet input
- **Response**: HTML home page

## 🔧 System Monitoring

Access the system monitoring dashboard at `/sysinfo` to view:

- **Memory Usage**: Heap usage, RSS, and V8 statistics
- **CPU Performance**: Process uptime and load metrics
- **Active Torrents**: Current torrent status and peer connections
- **Network Activity**: Download/upload speeds and bandwidth usage
- **Error Logs**: Recent errors and debugging information

## 🐛 Troubleshooting

### Common Issues

#### Video Won't Load

**Symptoms**: Endless loading spinner, no video appears
**Solutions**:

- Check if magnet link is valid and has active seeders
- Verify network connectivity and firewall settings
- Increase `CONFIG.RESOURCE_TIMEOUT` for slow connections
- Try a different torrent with more seeders

#### Subtitles Not Appearing

**Symptoms**: Video plays but no subtitles visible
**Solutions**:

- Ensure video file contains embedded subtitles
- Check browser console for SubtitlesOctopus errors
- Verify font files are accessible (`ARIALBD.TTF`, `NotoSansJP-Bold.ttf`)
- Try switching subtitle tracks using CC button

#### Performance Issues

**Symptoms**: Choppy playback, high CPU usage, memory leaks
**Solutions**:

- Lower `CONFIG.READY_THRESHOLD` for faster startup
- Reduce WebTorrent connections in environment config
- Enable `CONFIG.MANUAL_CLEANUP` for better resource management
- Close unused browser tabs and restart the server

#### Subtitle Rendering Errors

**Symptoms**: Console warnings about SubtitlesOctopus initialization
**Solutions**:

- Ignore harmless "Browser does not support creating object URLs" warnings
- Ensure only one SubtitlesOctopus instance per video
- Check that required fonts are loaded correctly
- Clear browser cache and localStorage

### Error Codes

| Code    | Meaning               | Solution                        |
| ------- | --------------------- | ------------------------------- |
| **503** | Resource not ready    | Wait for more download progress |
| **404** | Video file not found  | Check magnet link validity      |
| **416** | Range not satisfiable | Video file may be corrupted     |
| **429** | Too many requests     | Implement request throttling    |
| **500** | Server error          | Check server logs and restart   |

### Debug Mode

Enable detailed logging by setting `CONFIG.DEBUG_MODE = true` in `player.js`:

```javascript
// Enable debug logging
const CONFIG = {
  DEBUG_MODE: true, // Add this line
  // ... other config options
};
```

This will provide detailed console output for:

- Torrent connection attempts and peer discovery
- Subtitle extraction and rendering processes
- localStorage cleanup operations
- API request/response cycles
- Error stack traces and debugging information

### Browser Compatibility

| Browser     | Version | Support Level                 |
| ----------- | ------- | ----------------------------- |
| **Chrome**  | 90+     | ✅ Full support               |
| **Firefox** | 88+     | ✅ Full support               |
| **Safari**  | 14+     | ⚠️ Limited WebTorrent support |
| **Edge**    | 90+     | ✅ Full support               |
| **Mobile**  | Latest  | ⚠️ Performance dependent      |

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Install development dependencies**
   ```bash
   npm install --include=dev
   ```
4. **Make your changes**
5. **Test thoroughly**
6. **Submit a pull request**

### Code Style

- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Follow existing naming conventions
- Update documentation for new features

### Reporting Issues

When reporting bugs, please include:

- Node.js version
- Browser version
- Error messages and console logs
- Steps to reproduce the issue
- Example magnet links (if applicable)

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **WebTorrent** - P2P streaming technology
- **Plyr** - Modern video player interface
- **SubtitlesOctopus** - Advanced subtitle rendering
- **FFmpeg** - Video processing and subtitle extraction
- **Express.js** - Web application framework
- **The open-source community** - For continuous inspiration and support

---

_Star ⭐ this repository if you find it useful!_
