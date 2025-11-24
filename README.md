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
- **Magnet Validation**: Built-in validation to ensure only valid BitTorrent magnet links are processed
- **Embed Player**: Clean, minimal embed view for external websites with full-screen video display
- **Performance Optimized**: Debounced updates, passive event listeners, and intelligent caching

### 🎵 **Multi-Track Audio Support**

- **Audio Track Selection**: Switch between multiple audio tracks seamlessly
- **Real-time Switching**: Change audio tracks without interrupting playback
- **Language Detection**: Automatic audio track language identification
- **Custom UI**: Plyr-styled audio selector with microphone icon
- **Seamless Integration**: Works in both windowed and fullscreen modes

### 🎭 **Professional Subtitle System**

- **Multi-track Support**: Switch between multiple subtitle tracks
- **ASS/SSA Rendering**: Advanced subtitle formatting with SubtitlesOctopus
- **Real-time Extraction**: On-demand subtitle extraction from MKV files
- **Real-time Updates**: Smart subtitle refresh system with cache-busting for live content changes
- **Custom UI**: Plyr-styled subtitle selector with smooth animations
- **VTT Fallback**: Support for standard WebVTT subtitles
- **Performance Optimized**: Intelligent caching and debounced updates

### 🎮 **Modern Player Interface**

- **Plyr Integration**: Beautiful, responsive video player
- **Custom Controls**: CC button, quality indicator, and fullscreen support
- **Right-click Context Menu**: Real-time status display with video buffer, subtitle progress, and download stats
- **Resume Functionality**: Continue where you left off or restart from beginning
- **Loading Overlays**: Smooth transitions with blur effects during subtitle changes
- **Fullscreen Ready**: All overlays, controls, and context menu work seamlessly in fullscreen mode
- **Torrent File Support**: Drag-and-drop .torrent file support with automatic magnet generation

### 🚀 **Performance & Scalability**

- **Multi-user Support**: Each user can stream different torrents simultaneously
- **WebTorrent Powered**: Efficient P2P streaming technology with optimized piece selection
- **Resource Management**: Intelligent cleanup, memory optimization, and LRU caching
- **Cross-tab Sync**: Synchronized state across multiple browser tabs
- **Smart Piece Selection**: Seek-aware piece prioritization for smooth playback
- **Debounced Operations**: Reduced DOM manipulation and improved responsiveness
- **Memory Optimization**: Automatic cleanup of inactive torrents and cache management
- **Connection Optimization**: Reduced connection limits and intelligent peer management

### 🛠 **Developer Experience**

- **Live System Monitoring**: Real-time Node.js resource stats at `/sysinfo`
- **Comprehensive Logging**: Detailed debug information and error tracking
- **Configurable Settings**: Extensive configuration options via `CONFIG` object
- **API Endpoints**: RESTful API for status, subtitles, and video streaming

## 🚀 Recent Improvements

### Performance Optimizations (v2.0)

- **Faster Startup**: Reduced retry delays and optimized resource timeouts
- **Improved UI Responsiveness**: Debounced status updates and passive event listeners
- **Memory Management**: Smart DOM caching and automatic cleanup of inactive resources
- **Better Streaming**: Optimized piece selection and seek-aware torrent management
- **Resource Monitoring**: Enhanced tracking of memory usage and active torrents

### New Features (v2.0)

- **Multi-Track Audio Support**: Seamless switching between audio languages
- **Enhanced Subtitle System**: Improved rendering performance and track management
- **Better Error Handling**: More robust error recovery and user feedback
- **Cache Optimization**: LRU caching for frequently accessed torrents
- **Connection Management**: Intelligent peer limit adjustment for better performance

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
│   └── videoController.js       # Video streaming & file serving
│
├── 📂 routes/                    # Express route definitions
│   ├── playerRoutes.js          # /player endpoint
│   ├── embedRoutes.js           # /embed endpoint for embeddable player
│   ├── statusRoutes.js          # /status, /goodbye endpoints
│   ├── subtitleRoutes.js        # /subtitles, /subtitle-tracks endpoints
│   └── videoRoutes.js           # /video endpoint
│
├── 📂 services/                  # Core business services
│   └── torrentService.js        # WebTorrent management & lifecycle
│
├── 📂 libs/                      # Frontend assets & libraries
│   ├── player.js                # Main player application logic
│   ├── torrentPraser.js         # Parse Torrent file to get magnet
│   └── 📂 styles/               # CSS stylesheets
│       ├── style.css            # Custom UI styles
│       ├── embed.css            # Embed player styles
│       └── plyr.css             # Plyr video player styles
│   ├── 📂 fonts/                # Subtitle font files
│   │   ├── ARIALBD.TTF          # Subtitle font (Arial Bold)
│   │   └── NotoSansJP-Bold.ttf  # Japanese subtitle font
│   └── 📂 octopus/              # SubtitlesOctopus renderer
│       ├── subtitles-octopus.js # ASS/SSA subtitle renderer
│       ├── subtitles-octopus-worker.js
│       ├── subtitles-octopus-worker-legacy.js
│       └── subtitles-octopus-worker.wasm
│
├── 📂 views/                     # EJS template files
│   ├── index.ejs                # Home page template
│   ├── player.ejs               # Video player interface
│   ├── embed.ejs                # Embeddable player view
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
2. **Add Content**:
   - **Option A**: Paste any BitTorrent magnet URL
   - **Option B**: Drag and drop a .torrent file to auto-generate magnet link
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

### Embed Player

Use the embed player for external websites with a clean, full-screen interface:

```
http://localhost:3000/embed?url=<magnet-link>
```

**Embed Code:**

```html
<iframe
  src="http://localhost:3000/embed?url=magnet%3A%3Fxt%3Durn%3Abtih%3A..."
  width="640"
  height="360"
  frameborder="0"
  allowfullscreen
></iframe>
```

> **Tip**: Make sure to URL-encode the magnet link for proper parsing

### Player Controls

| Control               | Function                                   |
| --------------------- | ------------------------------------------ |
| **Play/Pause**        | Standard video playback control            |
| **Progress Bar**      | Seek to any position in the video          |
| **Volume**            | Audio level control                        |
| **Audio Button**      | Switch between multiple audio tracks       |
| **CC Button**         | Open subtitle track selector               |
| **Quality Indicator** | Displays video resolution                  |
| **Settings**          | Plyr player options                        |
| **Fullscreen**        | Expand to full screen mode                 |
| **Right-click Menu**  | Context menu with real-time status display |

### Context Menu Features

Right-click anywhere on the video player to access real-time information:

- **Video Buffer**: Current buffered percentage
- **Subtitle Status**: Active subtitle track and loading state
- **Subtitle Progress**: Subtitle download progress
- **Download Progress**: Overall torrent download progress
- **Close Button (×)**: Click to dismiss the context menu

The context menu works seamlessly in both windowed and fullscreen modes.

### Subtitle Management

- **Automatic Detection**: Subtitles are extracted automatically from MKV files
- **Multi-track Support**: Switch between different language tracks
- **Real-time Loading**: Subtitles load progressively as they become available
- **Smart Updates**: Intelligent refresh system that only updates changed content
- **Custom Styling**: Advanced formatting support with ASS/SSA rendering
- **Progress Monitoring**: Track subtitle download progress via context menu

### Resume Functionality

- **Auto-save**: Playback position is saved automatically
- **Resume Overlay**: Shows when returning to a partially watched video
- **Manual Control**: Choose to resume or restart from beginning

## ⚙️ Configuration

The application uses a comprehensive configuration system located in `libs/player.js`:

### Core Settings

```javascript
const CONFIG = {
  MAX_RETRIES: 15, // Reduced for faster failure handling
  BASE_RETRY_DELAY: 1500, // Faster initial retry (ms)
  MAX_RETRY_DELAY: 8000, // Reduced max retry delay (ms)
  CONTINUOUS_RETRY_INTERVAL: 25000, // Faster continuous retry (ms)
  STATUS_POLL_INTERVAL: 800, // Faster status updates for responsiveness (ms)
  READY_THRESHOLD: 256 * 1024, // Bytes needed before playback (256KB)
  RESOURCE_TIMEOUT: 250, // Reduced timeout for faster failure detection
  STALL_TIMEOUT: 15000, // Faster stall detection (ms)
  WATERMARK: false, // Show/hide watermark overlay
  WATERMARK_CONTENT: "Demo", // Watermark text content
  MANUAL_CLEANUP: false, // Enable immediate cleanup on page close
  AUTO_DELETE_HOURS: 72, // Auto-delete unused torrents (hours)
  // Performance optimizations
  DEBOUNCE_DELAY: 100, // For debounced operations (ms)
  DOM_CACHE_TIMEOUT: 5000, // Cache DOM queries (ms)
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

**GET** `/video?url=<magnet>&audioTrack=<n>`

- **Description**: Stream video content from torrent with specific audio track
- **Parameters**:
  - `url` (required): URL-encoded magnet link
  - `audioTrack` (optional): Audio track index for multi-track videos
- **Response**: Video stream (HTTP 206 for range requests)

### Audio Track Management

**GET** `/audio-tracks?url=<magnet>`

- **Description**: List available audio tracks
- **Parameters**:
  - `url` (required): URL-encoded magnet link
- **Response**: JSON array of audio track information

```json
[
  { "language": "eng", "title": "English" },
  { "language": "jpn", "title": "Japanese" }
]
```

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

**GET** `/embed?url=<magnet>`

- **Description**: Embeddable player interface with full-screen video
- **Response**: HTML embed player page

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

#### Audio Tracks Not Available

**Symptoms**: No audio track selector appears, microphone icon not visible
**Solutions**:

- Ensure video file contains multiple audio tracks
- Check browser console for audio track detection errors
- Verify FFmpeg can analyze the video file properly
- Try refreshing the page to re-initialize audio detection

#### Performance Issues

**Symptoms**: Choppy playbook, high CPU usage, memory leaks, slow UI responses
**Solutions**:

- Lower `CONFIG.READY_THRESHOLD` for faster startup
- Increase `CONFIG.DEBOUNCE_DELAY` to reduce update frequency
- Enable `CONFIG.MANUAL_CLEANUP` for better resource management
- Close unused browser tabs and restart the server
- Check torrent health and try torrents with more seeders
- Clear browser cache and localStorage to reset state

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
| **416** | Range not satisfiable | Check HTTP range header format  |
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

- **WebTorrent** - P2P streaming technology with optimized piece selection
- **Plyr** - Modern video player interface with custom control integration
- **SubtitlesOctopus** - Advanced subtitle rendering with performance optimizations
- **FFmpeg** - Video processing, subtitle extraction, and audio track analysis
- **Express.js** - Web application framework with efficient routing
- **The open-source community** - For continuous inspiration, performance insights, and support

---

_Star ⭐ this repository if you find it useful!_
