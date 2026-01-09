# MKV Video Player

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-39%2B-blue.svg)](https://electronjs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
[![WebTorrent](https://img.shields.io/badge/WebTorrent-2.6-blue.svg)](https://webtorrent.io/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

> A modern, cross-platform video player for streaming MKV/MP4 files directly from BitTorrent magnets with instant playback, multi-track audio/subtitle support, and professional ASS/SSA subtitle rendering. Available as both a web application and native desktop app.

## 🎯 Deployment Options

### 🌐 **Web Application**

- Traditional Node.js web server accessible via browser
- Perfect for server deployments and remote access
- Access via `http://localhost:3000`

### 🖥️ **Desktop Application**

- Native Electron desktop app with system integration
- Embedded web server with automatic startup/shutdown
- Native menus, dialogs, and window management

## ✨ Key Features

### 🎬 **Advanced Video Streaming**

- **Instant Playback**: Streaming starts with just 256KB downloaded
- **Progressive Loading**: No waiting for complete downloads
- **Smart Piece Selection**: Prioritizes first 20 pieces containing video metadata
- **Multi-format Support**: MKV, MP4, and other common video formats
- **HTTP Range Requests**: Efficient seeking and bandwidth usage
- **Magnet Validation**: Built-in BitTorrent magnet link validation
- **Auto-delete**: Configurable automatic cleanup after 72 hours

### 🎵 **Multi-Track Audio Support**

- **Audio Track Selection**: Switch between multiple audio languages seamlessly
- **Real-time Transcoding**: FFmpeg-powered audio track conversion to WebM/Opus
- **Language Detection**: Automatic audio track language identification using FFprobe
- **Custom UI**: Plyr-styled audio selector with microphone icon
- **Synchronization**: Audio timing offset detection for perfect sync

### 🎭 **Professional Subtitle System**

- **Multi-track Support**: Switch between multiple subtitle languages
- **ASS/SSA Rendering**: Advanced subtitle formatting with SubtitlesOctopus and libass-wasm
- **Real-time Extraction**: On-demand subtitle extraction from MKV files using FFmpeg
- **Format Support**: ASS, SSA, VTT, SRT, SUB with automatic conversion
- **Smart Updates**: Intelligent subtitle refresh with content hash detection
- **Custom Fonts**: Includes Arial Bold and Japanese (NotoSansJP) fonts
- **Fallback System**: Graceful degradation when subtitles unavailable

### 🎮 **Modern Player Interface**

- **Plyr Integration**: Beautiful, responsive HTML5 video player
- **Custom Controls**: CC button, audio selector, quality indicator, and fullscreen
- **Context Menu**: Right-click for real-time status (buffer, download progress, subtitle status)
- **Resume Functionality**: Continue where you left off or restart from beginning
- **Loading Overlays**: Smooth transitions with visual feedback
- **Fullscreen Ready**: All controls work seamlessly in fullscreen mode
- **Torrent File Support**: Drag-and-drop .torrent files with automatic magnet generation

### 🚀 **Performance & Security**

- **Smart Rate Limiting**: Endpoint-specific limits optimized for streaming (10K for media, 5K for polling)
- **Security Headers**: Helmet-powered protection with Content Security Policy
- **Resource Management**: Intelligent cleanup and memory optimization
- **Multi-user Support**: Concurrent torrent streaming for different users
- **WebTorrent Optimization**: Efficient P2P streaming with connection management
- **Compression**: Gzip compression for non-media responses
- **Auto-extend**: Automatic timeout extension when video is actively streamed

### 🖥️ **Desktop Integration**

- **Auto Server Management**: Automatic Express server startup/shutdown
- **Native Menus**: File menu with magnet link dialog (Ctrl+O)
- **Window Management**: Minimize, maximize, fullscreen controls
- **Custom Dialogs**: Native input dialogs for magnet links
- **Cross-platform**: Windows, macOS, and Linux support

### 🛠️ **Developer Experience**

- **Live System Monitoring**: Real-time stats at `/sysinfo`
- **Centralized Configuration**: Modular config in `configs/all.config.js`
- **Comprehensive Logging**: Debug mode with detailed output
- **Modular Architecture**: Clean separation of concerns with dedicated folders
- **ES6 Modules**: Modern JavaScript with proper imports/exports
- **Class-based Frontend**: Organized player logic with UIController, SubtitlesManager, etc.

## 🏗 Architecture Overview

### 📁 Project Structure

```
MKV-Player-WebTorrent/
│
├── 📄 app.js                     # Main Express server application
├── 📄 electron-main.js           # Electron main process (desktop app)
├── 📄 launcher.js                # Universal launcher (web/desktop/dev)
├── 📄 package.json               # Dependencies & scripts
├── 📄 package-lock.json          # Dependency lock file
├── 📄 favicon.ico                # Application icon
├── 📄 favicon.png                # Application icon (PNG format)
├── 📄 .npmrc                     # NPM configuration
├── 📄 .gitignore                 # Git ignore rules
│
├── 📂 configs/                   # Centralized configuration
│   └── all.config.js             # PERF_CONFIG and PLAYER_CONFIG exports
│
├── 📂 controllers/               # Business logic controllers
│   ├── audioController.js        # Audio track management API
│   ├── playerController.js       # Player page rendering & config
│   ├── statusController.js       # Torrent status & progress API
│   ├── subtitleController.js     # Subtitle management API
│   └── videoController.js        # Video streaming & file serving
│
├── 📂 routes/                    # Express route definitions
│   ├── audioRoutes.js            # /audio-tracks endpoint
│   ├── playerRoutes.js           # /player endpoint
│   ├── embedRoutes.js            # /embed endpoint for embeddable player
│   ├── statusRoutes.js           # /status, /goodbye endpoints
│   ├── subtitleRoutes.js         # /subtitles, /subtitle-tracks endpoints
│   └── videoRoutes.js            # /video endpoint
│
├── 📂 services/                  # Core business services
│   └── torrentService.js         # WebTorrent management & lifecycle
│
├── 📂 utils/                     # Utility functions & helpers
│   ├── magnetValidator.js        # Magnet link validation utility
│   └── security.js               # Security middleware & rate limiting
│
├── 📂 libs/                      # Frontend assets & libraries
│   ├── player.js                 # Main player application logic (4200+ lines)
│   ├── torrentPraser.js          # Parse .torrent files to get magnet
│   ├── 📂 styles/                # CSS stylesheets
│   │   ├── style.css             # Custom UI styles
│   │   ├── embed.css             # Embed player styles
│   │   └── plyr.css              # Plyr video player styles
│   ├── 📂 fonts/                 # Subtitle font files
│   │   ├── ARIALBD.TTF           # Arial Bold font for subtitles
│   │   └── NotoSansJP-Bold.ttf   # Japanese subtitle font
│   └── 📂 octopus/               # SubtitlesOctopus renderer
│       ├── subtitles-octopus.js  # ASS/SSA subtitle renderer
│       ├── subtitles-octopus-worker.js
│       ├── subtitles-octopus-worker-legacy.js
│       └── subtitles-octopus-worker.wasm
│
└── 📂 views/                     # EJS template files
    ├── index.ejs                 # Home page template
    ├── player.ejs                # Video player interface
    ├── embed.ejs                 # Embeddable player view
    └── sysinfo.ejs               # System monitoring dashboard
```

### Technology Stack

| Component            | Technology                  | Purpose                                 |
| -------------------- | --------------------------- | --------------------------------------- |
| **Backend**          | Node.js + Express 5.x       | HTTP server & API endpoints             |
| **Desktop App**      | Electron 39+                | Native cross-platform desktop wrapper   |
| **Security**         | Helmet + express-rate-limit | Security headers & smart rate limiting  |
| **Streaming**        | WebTorrent 2.6              | P2P video streaming                     |
| **Video Processing** | FFmpeg + fluent-ffmpeg      | Subtitle extraction & audio transcoding |
| **Frontend**         | Vanilla JS + EJS            | Responsive UI with ES6 modules          |
| **Video Player**     | Plyr                        | Modern HTML5 video player               |
| **Subtitles**        | SubtitlesOctopus + libass   | Advanced ASS/SSA subtitle rendering     |
| **Compression**      | gzip                        | Response compression                    |

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

   **Key Dependencies Installed:**
   - `electron` (39.2.7) - Desktop application framework
   - `@electron-forge/cli` - Build and packaging tools
   - `express` (5.1.0) - Web framework
   - `express-rate-limit` (8.2.1) - Smart rate limiting
   - `helmet` (8.1.0) - Security headers and CSP
   - `webtorrent` (2.6.8) - P2P streaming technology
   - `ffmpeg-static` (5.2.0) - Video processing
   - `fluent-ffmpeg` (2.1.3) - FFmpeg wrapper
   - `libass-wasm` (4.1.0) - Advanced subtitle rendering

## 🖥️ Desktop Application

### Quick Launch (Recommended)

Use the universal launcher to start the app in different modes:

```bash
# Desktop application (default)
node launcher.js electron

# Web server only
node launcher.js web

# Development mode with auto-reload
node launcher.js dev

# Show launcher help
node launcher.js help
```

### NPM Scripts

```bash
# Launch desktop app
npm run electron

# Launch desktop app in development mode
npm run electron-dev

# Start web server only
npm start
# or
npm run dev

# Build desktop with ZIP
npm run build

# Package without ZIP
npm run electron-pack
```

### Desktop Features

- **🎮 Native Menu**: File → Open Magnet Link (Ctrl+O)
- **⌨️ Keyboard Shortcuts**:
  - `Ctrl+O` - Open magnet dialog
  - `Ctrl+R` - Reload player
  - `F11` - Toggle fullscreen
- **🎯 Auto Server**: Automatically starts/stops the web server
- **📱 Native Dialogs**: Custom input dialogs for magnet links
- **🔄 Window Management**: Native window controls and system integration

### Build Distribution

Create distributable desktop applications:

```bash
# Build for current platform ( ZIP )
npm run build

# Package only (no ZIP)
npm run electron-pack
```

**Output locations:**

- **Packages**: `./out/MKV-Video-Player-{platform}/`
- **Zip**: `./out/make/`

## 🌐 Web Application

### Traditional Web Server

```bash
# Start web server
npm start
# or
node app.js
# or
node launcher.js web
```

**Access the application:**

```
http://localhost:3000
```

### Development Mode

```bash
npm run dev
# or
nodemon app.js --no-debug
```

This starts the web server with nodemon for automatic restarts on file changes.

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

Use the embed player for external websites:

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

### Player Controls

| Control               | Function                             |
| --------------------- | ------------------------------------ |
| **Play/Pause**        | Standard video playback control      |
| **Progress Bar**      | Seek to any position in the video    |
| **Volume**            | Audio level control                  |
| **Audio Button** 🎤   | Switch between multiple audio tracks |
| **CC Button**         | Open subtitle track selector         |
| **Quality Indicator** | Displays video resolution            |
| **Settings**          | Plyr player options                  |
| **Fullscreen**        | Expand to full screen mode           |
| **Right-click Menu**  | Context menu with real-time status   |

### Context Menu Features

Right-click anywhere on the video player to access:

- **Video Buffer**: Current buffered percentage
- **Subtitle Status**: Active subtitle track and loading state
- **Subtitle Progress**: Subtitle download progress
- **Download Progress**: Overall torrent download progress
- **Close Button (×)**: Click to dismiss the menu

### Audio & Subtitle Management

- **Multi-track Audio**: Automatic detection and switching between audio languages
- **Audio Transcoding**: Real-time conversion to WebM/Opus for web compatibility
- **Subtitle Tracks**: Switch between different subtitle languages using CC button
- **Real-time Extraction**: Subtitles extracted on-demand from MKV files using FFmpeg
- **Format Support**: ASS/SSA with advanced formatting, VTT, SRT automatic conversion
- **Progress Monitoring**: Track subtitle/audio processing via context menu

## ⚙️ Configuration

All configuration is centralized in `configs/all.config.js` with named exports.

### Performance Configuration (PERF_CONFIG)

```javascript
export const PERF_CONFIG = {
  MAX_CONCURRENT_TORRENTS: 15, // Maximum simultaneous torrents
  PIECE_SELECTION_BATCH_SIZE: 25, // Pieces per selection batch
  PIECE_SELECTION_INTERVAL: 3, // Skip interval for piece selection
  INITIAL_DOWNLOAD_SIZE: 12 * MB, // Initial buffer (12MB)
  STREAMING_DOWNLOAD_SIZE: 8 * MB, // Streaming buffer (8MB)
  RESOURCE_LOG_INTERVAL: 3 * 60 * 1000, // 3 minutes
  CLEANUP_INTERVAL: 20 * 60 * 1000, // 20 minutes
  FILE_WATCH_DEBOUNCE: 500, // File watch debounce (ms)
  MAX_FILE_SIZE: 10 * 1024 * MB, // 10GB max file size
  CONNECTION_TIMEOUT: 30000, // Connection timeout (30s)
};
```

### Player Configuration (PLAYER_CONFIG)

```javascript
export const PLAYER_CONFIG = {
  MAX_RETRIES: 20, // Maximum retry attempts
  BASE_RETRY_DELAY: 1000, // Initial retry delay (ms)
  MAX_RETRY_DELAY: 6000, // Maximum retry delay (ms)
  CONTINUOUS_RETRY_INTERVAL: 20000, // Continuous polling (20s)
  STATUS_POLL_INTERVAL: 600, // Status update frequency (ms)
  READY_THRESHOLD: 512 * 1024, // 512KB minimum before playback
  RESOURCE_TIMEOUT: 200, // Resource load timeout (ms)
  STALL_TIMEOUT: 12000, // Stall detection (12s)
  WATERMARK: false, // Show/hide watermark
  MANUAL_CLEANUP: false, // Immediate cleanup on close
  AUTO_DELETE_HOURS: 72, // Auto-delete after 72 hours
  DEBUG_MODE: true, // Enable debug logging
};
```

### Security Configuration

Smart rate limiting in `utils/security.js`:

```javascript
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: async (req) => {
    if (req.url.includes("/video") || req.url.includes("/audio")) {
      return 10000; // High limit for media streaming
    }
    if (req.url.includes("/subtitles") || req.url.includes("/status")) {
      return 5000; // High limit for polling
    }
    return 500; // Default limit
  },
  skip: (req) => req.hostname === "localhost",
});
```

## 🔌 API Reference

### Video Streaming

**GET** `/video?url=<magnet>&audioTrack=<n>`

- **Description**: Stream video content with optional audio track selection
- **Parameters**:
  - `url` (required): URL-encoded magnet link
  - `audioTrack` (optional): Audio track index for multi-track videos
  - `t` (optional): Start time for seeking
- **Response**: Video stream (HTTP 206 for range requests)

### Audio Track Management

**GET** `/audio-tracks?url=<magnet>`

- **Description**: List available audio tracks using FFprobe
- **Response**: JSON array of audio track information

```json
[
  { "language": "eng", "title": "English" },
  { "language": "jpn", "title": "Japanese" }
]
```

**GET** `/audio-timing?url=<magnet>&track=<n>`

- **Description**: Get audio track timing offset for synchronization

### Subtitle Management

**GET** `/subtitles?url=<magnet>&track=<n>`

- **Description**: Extract and serve ASS/SSA subtitle track
- **Parameters**:
  - `url` (required): URL-encoded magnet link
  - `track` (optional): Track index (default: 0)
- **Response**: ASS/SSA subtitle content with fallback

**GET** `/subtitle-tracks?url=<magnet>`

- **Description**: List available subtitle tracks using FFprobe
- **Response**: JSON array of track information

**GET** `/subtitles-vtt?url=<magnet>&track=<n>`

- **Description**: Extract subtitles as WebVTT format with automatic conversion

### Status & Monitoring

**GET** `/status?url=<magnet>`

- **Description**: Get real-time torrent download status
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

- **Description**: System resource monitoring dashboard
- **Response**: HTML page with real-time Node.js stats

**POST** `/goodbye?url=<magnet>`

- **Description**: Cleanup torrent resources and downloaded files
- **Response**: JSON cleanup confirmation

### Player Interface

**GET** `/player?url=<magnet>`

- **Description**: Main player interface with full controls
- **Response**: HTML player page with Plyr integration

**GET** `/embed?url=<magnet>`

- **Description**: Embeddable player interface for external sites
- **Response**: HTML embed player page

**GET** `/`

- **Description**: Home page with magnet input and torrent file upload
- **Response**: HTML home page with drag-and-drop support

## 🐛 Troubleshooting

### Common Issues

#### Video Won't Load

**Symptoms**: Endless loading, no video appears
**Solutions**:

- Check if magnet link is valid and has active seeders
- Verify network connectivity and firewall settings
- Increase `PLAYER_CONFIG.RESOURCE_TIMEOUT` for slow connections
- Try a different torrent with more seeders
- Check browser console for WebTorrent connection errors

#### Subtitles Not Appearing

**Symptoms**: Video plays but no subtitles visible
**Solutions**:

- Ensure video file contains embedded subtitles (MKV format required)
- Check browser console for SubtitlesOctopus errors
- Verify font files are accessible in `/libs/fonts/`
- Try switching subtitle tracks using CC button
- Wait for MKV analysis to complete (requires 1MB+ downloaded)

#### Audio Tracks Not Available

**Symptoms**: No audio track selector appears
**Solutions**:

- Ensure video file contains multiple audio tracks
- Check browser console for FFmpeg/FFprobe analysis errors
- Verify video has enough data downloaded for analysis (1MB minimum)
- Refresh page to re-initialize audio detection
- Check if MKV format (other formats may have limited support)

#### Performance Issues

**Symptoms**: Choppy playback, high CPU usage, slow responses
**Solutions**:

- Lower `PLAYER_CONFIG.READY_THRESHOLD` for faster startup (current: 512KB)
- Increase `PLAYER_CONFIG.STATUS_POLL_INTERVAL` to reduce polling frequency
- Enable `PLAYER_CONFIG.MANUAL_CLEANUP` for better resource management
- Check torrent health and try torrents with more seeders
- Clear browser cache and localStorage
- Disable unnecessary browser extensions

### Debug Mode

Enable detailed logging by setting `DEBUG_MODE = true` in `configs/all.config.js`:

```javascript
export const PLAYER_CONFIG = {
  DEBUG_MODE: true,
  // ... other config options
};
```

This provides detailed console output for:

- Torrent connection attempts and peer discovery
- Subtitle extraction and rendering processes (FFmpeg operations)
- Audio track detection and transcoding
- SubtitlesOctopus initialization and font loading
- API request/response cycles
- Error stack traces and debugging information

### Browser Compatibility

| Browser     | Version | Support Level         | Notes                    |
| ----------- | ------- | --------------------- | ------------------------ |
| **Chrome**  | 90+     | ✅ Full support       | Recommended              |
| **Firefox** | 88+     | ✅ Full support       | Excellent WebTorrent     |
| **Safari**  | 14+     | ⚠️ Limited WebTorrent | Basic functionality only |
| **Edge**    | 90+     | ✅ Full support       | Chromium-based           |

## 🔧 Development & Deployment

### Development Commands

```bash
# Development with auto-reload
npm run dev                  # Web server with nodemon
npm run electron-dev         # Desktop app with DevTools

# Standard launch
npm start                    # Web server only
npm run electron            # Desktop application

# Universal launcher
node launcher.js dev         # Development mode
node launcher.js web         # Web server
node launcher.js electron    # Desktop app
```

### Class Architecture (Frontend)

The frontend uses a sophisticated class-based architecture:

- **VideoPlayerController** - Main orchestrator class
- **UIController** - DOM manipulation and interface updates
- **SubtitlesManager** - Multi-track subtitle handling with SubtitlesOctopus
- **StatusPoller** - Torrent status and progress monitoring
- **ResourceLoader** - Video and subtitle resource loading
- **RetryController** - Exponential backoff retry logic
- **FullscreenController** - Fullscreen mode overlay management

### Build & Distribution

```bash
# Build desktop app
npm run build               # Full build with zip
npm run electron-pack      # Package only (no zip)

# Build outputs
./out/MKV-Video-Player-win32-x64/     # Package
./out/make/                           # Platform-specific zip
```

### Key Configuration Files

- [package.json](package.json) - Dependencies and build settings (ISC license)
- [configs/all.config.js](configs/all.config.js) - Application configuration
- [electron-main.js](electron-main.js) - Desktop app settings
- [app.js](app.js) - Web server configuration with security middleware
- [utils/security.js](utils/security.js) - Smart rate limiting and security headers

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Install development dependencies**: `npm install`
4. **Make your changes**
5. **Test thoroughly** (especially subtitle and audio track functionality)
6. **Submit a pull request**

### Code Style

- Use consistent indentation (2 spaces)
- Follow ES6 module syntax with proper imports/exports
- Add comments for complex logic (especially FFmpeg operations)
- Update documentation for new features
- Test with various MKV files containing multiple audio/subtitle tracks

### Reporting Issues

When reporting bugs, please include:

- Node.js and browser versions
- Error messages and console logs (especially FFmpeg/WebTorrent errors)
- Steps to reproduce the issue
- Example magnet links and file formats (if applicable)
- Whether issue occurs in web or desktop mode

## 📄 License

This project is licensed under the **ISC License**.

## 🙏 Acknowledgments

- **Electron** - Cross-platform desktop application framework
- **WebTorrent** - Peer-to-peer streaming in the browser
- **Plyr** - Modern HTML5 video player with custom controls
- **SubtitlesOctopus + libass-wasm** - Advanced ASS/SSA subtitle rendering
- **FFmpeg** - Video processing, subtitle extraction, and audio transcoding
- **Express.js** - Fast, minimalist web framework
- **fluent-ffmpeg** - Node.js FFmpeg wrapper for audio/subtitle processing
- **The open-source community** - For continuous inspiration and support

---

⭐ **Star this repository if you find it useful!**
