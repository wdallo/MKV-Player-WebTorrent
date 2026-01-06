# MKV Player WebTorrent

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-39%2B-blue.svg)](https://electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

> A modern, cross-platform video player application for streaming MKV/MP4 files directly from BitTorrent magnets with instant playback, advanced subtitle support, and intelligent resource management. Available as both a **web application** and a **native desktop app** powered by Electron.

## 🎯 Deployment Options

### 🌐 **Web Application**

- Run as a traditional Node.js web server
- Access via web browser at `localhost:3000`
- Perfect for server deployments and remote access

### 🖥️ **Desktop Application**

- Native desktop app built with Electron
- Familiar desktop experience with system integration
- Custom menus, keyboard shortcuts, and native dialogs

## ✨ Key Features

### 🎬 **Advanced Video Streaming**

- **Instant Playback**: Stream starts as soon as ~256KB is downloaded
- **Progressive Loading**: No need to wait for complete downloads
- **Multi-format Support**: MKV, MP4, and other common video formats
- **Quality Detection**: Automatic video resolution display (480p, 720p, 1080p, etc.)
- **Magnet Validation**: Built-in validation utility (`utils/magnetValidator.js`) to ensure only valid BitTorrent magnet links are processed
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

### �️ **Desktop Integration (Electron)**

- **Native Desktop App**: Executable
- **System Integration**: Native window controls, taskbar icon, and system tray
- **Menu Integration**: File menu with magnet link dialog and keyboard shortcuts
- **Custom Dialogs**: Native input dialogs for magnet links with validation
- **Auto Server Management**: Automatically starts and stops the Express server
- **Installer Packages**: Professional Windows installers with Squirrel

### �🛠 **Developer Experience**

- **Live System Monitoring**: Real-time Node.js resource stats at `/sysinfo`
- **Comprehensive Logging**: Detailed debug information and error tracking
- **Centralized Configuration**: Modular config system in `configs/all.config.js`
- **Utility Functions**: Reusable utilities in `utils/` folder (magnet validation, security, etc.)
- **API Endpoints**: RESTful API for status, subtitles, and video streaming
- **Modular Architecture**: Clean separation of concerns with dedicated folders
- **ES6 Modules**: Full modern JavaScript module support with proper imports/exports

### 🔒 **Security & Performance**

- **Smart Rate Limiting**: Dynamic request limits optimized for streaming applications
- **Content Security Policy**: Helmet-powered security headers with CDN whitelist support
- **XSS Protection**: All innerHTML usage replaced with secure DOM manipulation
- **Input Sanitization**: Comprehensive validation for magnet URLs and file paths
- **Request Monitoring**: Security logging and suspicious activity detection
- **Streaming-Optimized Limits**: Different rate limits for media vs. page endpoints

## 🚀 Recent Improvements

### Security & Module Enhancements (v4.0)

- **Security Framework**: Complete security middleware with Helmet integration
- **Smart Rate Limiting**: Streaming-optimized rate limits with endpoint-specific rules
- **XSS Prevention**: All innerHTML usage replaced with secure DOM manipulation methods
- **Content Security Policy**: Configurable CSP with trusted CDN whitelist support
- **ES6 Module Compatibility**: Resolved all browser import/export issues with proper module declarations
- **Input Validation**: Enhanced magnet URL validation and path traversal protection

### Architecture Improvements (v3.0-4.0)

- **Centralized Configuration**: All settings moved to `configs/all.config.js` with named exports
- **Security Utilities**: New `utils/security.js` with comprehensive security middleware
- **Magnet Validation**: Dedicated `utils/magnetValidator.js` for enhanced URL validation
- **Modular Design**: Better separation of concerns with dedicated folders for configs and utilities
- **ES6 Modules**: Full migration to modern JavaScript import/export syntax with browser compatibility
- **Code Organization**: Improved project structure for better maintainability and security

### Performance Optimizations (v2.0-3.0)

- **Faster Startup**: Reduced retry delays and optimized resource timeouts
- **Improved UI Responsiveness**: Debounced status updates and passive event listeners
- **Memory Management**: Smart DOM caching and automatic cleanup of inactive resources
- **Better Streaming**: Optimized piece selection and seek-aware torrent management
- **Resource Monitoring**: Enhanced tracking of memory usage and active torrents
- **Batch Processing**: Optimized piece selection with configurable batch sizes

### New Features (v2.0-3.0)

- **Multi-Track Audio Support**: Seamless switching between audio languages
- **Enhanced Subtitle System**: Improved rendering performance and track management
- **Better Error Handling**: More robust error recovery and user feedback
- **Cache Optimization**: LRU caching for frequently accessed torrents
- **Connection Management**: Intelligent peer limit adjustment for better performance
- **Magnet Link Validation**: Dedicated utility for validating BitTorrent magnet links
- **Debug Mode**: Comprehensive logging system for development and troubleshooting

## 🏗 Architecture Overview

### Project Structure

```
MKV-Player-WebTorrent/
├── 📁 app.js                     # Express server & middleware setup
### 📁 Project Structure

```

MKV-Player-WebTorrent/
│
├── 📁 app.js # Main Express server application
├── 📁 electron-main.js # Electron main process (desktop app)
├── 📁 launcher.js # Universal launcher (web/desktop/dev)
├── 📁 preload.js # Electron preload script (security)
├── 📁 package.json # Dependencies & scripts
├── 📁 package-lock.json # Dependency lock file
├── 📁 favicon.ico # Application icon
├── 📁 .npmrc, .gitignore # Configuration files
│
├── 📂 configs/ # Centralized configuration
│ └── all.config.js # PERF_CONFIG and PLAYER_CONFIG exports
│
├── 📂 controllers/ # Business logic controllers
│ ├── audioController.js # Audio track management API
│ ├── playerController.js # Player page rendering & config
│ ├── statusController.js # Torrent status & progress API
│ ├── subtitleController.js # Subtitle management API
│ └── videoController.js # Video streaming & file serving
│
├── 📂 routes/ # Express route definitions
│ ├── audioRoutes.js # /audio-tracks endpoint
│ ├── playerRoutes.js # /player endpoint
│ ├── embedRoutes.js # /embed endpoint for embeddable player
│ ├── statusRoutes.js # /status, /goodbye endpoints
│ ├── subtitleRoutes.js # /subtitles, /subtitle-tracks endpoints
│ └── videoRoutes.js # /video endpoint
│
├── 📂 services/ # Core business services
│ └── torrentService.js # WebTorrent management & lifecycle
│
├── 📂 utils/ # Utility functions & helpers
│ ├── magnetValidator.js # Enhanced magnet link validation utility
│ └── security.js # Security middleware & utilities (rate limiting, CSP, etc.)
│
├── 📂 libs/ # Frontend assets & libraries
│ ├── player.js # Main player application logic
│ ├── torrentPraser.js # Parse Torrent file to get magnet
│ └── 📂 styles/ # CSS stylesheets
│ ├── style.css # Custom UI styles
│ ├── embed.css # Embed player styles
│ └── plyr.css # Plyr video player styles
│ ├── 📂 fonts/ # Subtitle font files
│ │ ├── ARIALBD.TTF # Subtitle font (Arial Bold)
│ │ └── NotoSansJP-Bold.ttf # Japanese subtitle font
│ └── 📂 octopus/ # SubtitlesOctopus renderer
│ ├── subtitles-octopus.js # ASS/SSA subtitle renderer
│ ├── subtitles-octopus-worker.js
│ ├── subtitles-octopus-worker-legacy.js
│ └── subtitles-octopus-worker.wasm
│
├── 📂 views/ # EJS template files
│ ├── index.ejs # Home page template
│ ├── player.ejs # Video player interface
│ ├── embed.ejs # Embeddable player view
│ └── sysinfo.ejs # System monitoring dashboard
│
└── 📂 downloads/ # Temporary torrent file storage

````

### Technology Stack

| Component            | Technology                  | Purpose                                |
| -------------------- | --------------------------- | -------------------------------------- |
| **Backend**          | Node.js + Express           | HTTP server & API endpoints            |
| **Desktop App**      | Electron                    | Native cross-platform desktop wrapper |
| **Security**         | Helmet + express-rate-limit | Security headers & smart rate limiting |
| **Streaming**        | WebTorrent                  | P2P video streaming                    |
| **Video Processing** | FFmpeg                      | Subtitle extraction & video analysis   |
| **Frontend**         | Vanilla JS + EJS            | Responsive UI with ES6 modules         |
| **Video Player**     | Plyr                        | Modern HTML5 video player              |
| **Subtitles**        | SubtitlesOctopus            | Advanced ASS/SSA subtitle rendering    |

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
````

2. **Install dependencies**

   ```bash
   npm install
   ```

   **Key Dependencies Installed:**
   - `electron` - Desktop application framework
   - `@electron-forge/cli` - Build and packaging tools
   - `express-rate-limit` - Smart rate limiting for streaming applications
   - `helmet` - Security headers and content security policy
   - `webtorrent` - P2P streaming technology
   - `ffmpeg-static` - Video processing and subtitle extraction
   - `plyr` - Modern video player interface

## 🖥️ Desktop Application

### Quick Launch (Recommended)

Use the universal launcher to start the app in different modes:

```bash
# Desktop application (default Electron app)
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
npm run web

# Build desktop executables
npm run build

# Package without installer (faster)
npm run electron-pack
```

### Desktop Features

- **🎮 Native Menu**: File → Open Magnet Link (Ctrl+O)
- **⌨️ Keyboard Shortcuts**:
  - `Ctrl+O` - Open magnet dialog
  - `Ctrl+R` - Reload player
  - `Ctrl+Shift+R` - Force reload
  - `F11` - Toggle fullscreen
- **🎯 Auto Server**: Automatically starts/stops the web server
- **📱 Native Dialogs**: Custom input dialogs for magnet links
- **🔄 Window Management**: Minimize, close, and fullscreen controls

### Build Distribution

Create distributable desktop applications:

```bash
# Build for current platform
npm run build

# Package only (no installer)
npm run electron-pack
```

**Output locations:**

- **Executables**: `./out/MKV-Video-Player-{platform}/`
- **Installers**: `./out/make/`
- **ZIP packages**: `./out/make/zip/`

## 🌐 Web Application

### Traditional Web Server

Perfect for server deployments, remote access, or development:

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

For active development with auto-reload:

```bash
npm run dev
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

All configuration objects are centralized in `configs/all.config.js` with named exports for easy management and importing.

### Core Settings

#### Performance Configuration (PERF_CONFIG)

Handles torrent management, streaming optimization, and system performance:

```javascript
export const PERF_CONFIG = {
  MAX_CONCURRENT_TORRENTS: 10, // Maximum simultaneous torrents
  PIECE_SELECTION_BATCH_SIZE: 20, // Optimized batch size for better performance
  PIECE_SELECTION_INTERVAL: 5, // Milliseconds between piece selections
  INITIAL_DOWNLOAD_SIZE: 8 * 1024 * 1024, // 8MB for faster startup
  STREAMING_DOWNLOAD_SIZE: 5 * 1024 * 1024, // 5MB for streaming
  RESOURCE_LOG_INTERVAL: 5 * 60 * 1000, // 5 minutes between resource logs
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes cleanup interval
  FILE_WATCH_DEBOUNCE: 1000, // 1 second debounce for file events
};
```

#### Player Configuration (PLAYER_CONFIG)

Controls video player behavior, retry logic, and user interface settings:

```javascript
export const PLAYER_CONFIG = {
  MAX_RETRIES: 15, // Retry attempts for failed operations
  BASE_RETRY_DELAY: 1500, // Initial retry delay (ms)
  MAX_RETRY_DELAY: 8000, // Maximum retry delay (ms)
  CONTINUOUS_RETRY_INTERVAL: 25000, // Continuous polling interval
  STATUS_POLL_INTERVAL: 800, // Status update frequency
  READY_THRESHOLD: 256 * 1024, // 256KB threshold for playback start
  RESOURCE_TIMEOUT: 250, // Resource loading timeout
  STALL_TIMEOUT: 15000, // Stall detection timeout
  WATERMARK: false, // Show/hide watermark overlay
  WATERMARK_CONTENT: "Demo Watermark", // Watermark text content
  MANUAL_CLEANUP: false, // Immediate cleanup on page close
  AUTO_DELETE_HOURS: 72, // Auto-delete unused torrents (hours)
  DEBUG_MODE: true, // Enable/disable debug logging
};
```

### Usage

Import configurations in your modules:

```javascript
import { PERF_CONFIG, PLAYER_CONFIG } from "../configs/all.config.js";

// Use in your code
const maxRetries = PLAYER_CONFIG.MAX_RETRIES;
const batchSize = PERF_CONFIG.PIECE_SELECTION_BATCH_SIZE;
```

### Security Configuration

The application includes comprehensive security middleware configured in `utils/security.js`:

```javascript
// Smart Rate Limiting (streaming-optimized)
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: async (req) => {
    // Different limits based on endpoint
    if (req.url.includes("/video") || req.url.includes("/audio")) {
      return 10000; // High limit for media streaming
    }
    if (req.url.includes("/subtitles") || req.url.includes("/status")) {
      return 5000; // High limit for polling endpoints
    }
    return 500; // Default limit
  },
  skip: (req) => req.hostname === "localhost", // Skip localhost
});

// Security Headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
      // ... other security directives
    },
  },
});
```

### Benefits

- **Centralized Management**: All settings in one location
- **Named Exports**: Easy to import specific configs
- **Security Framework**: Built-in protection against common web vulnerabilities
- **Streaming Optimized**: Rate limits designed for media applications
- **Easy Customization**: Modify settings without touching core logic

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
// In configs/all.config.js
export const PLAYER_CONFIG = {
  WATERMARK: true, // Enable watermark
  WATERMARK_CONTENT: "Your Brand Name", // Custom watermark text
  // ...other settings
};
```

#### Cleanup Behavior

```javascript
// In configs/all.config.js
export const PLAYER_CONFIG = {
  MANUAL_CLEANUP: true, // Enable immediate cleanup on page close
  AUTO_DELETE_HOURS: 24, // Auto-delete after 24 hours
  // ...other settings
};
```

#### Performance Tuning

```javascript
// In configs/all.config.js
export const PLAYER_CONFIG = {
  READY_THRESHOLD: 128 * 1024, // 128KB for faster startup
  MAX_RETRIES: 50, // More stable connections
  MAX_RETRY_DELAY: 30000, // Higher retry limits
  // ...other settings
};

export const PERF_CONFIG = {
  MAX_CONCURRENT_TORRENTS: 20, // Handle more torrents
  PIECE_SELECTION_BATCH_SIZE: 30, // Larger batches for high-speed connections
  // ...other settings
};
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

#### ES6 Module Import Errors

**Symptoms**: "Cannot use import statement outside a module" errors
**Solutions**:

- Ensure all script tags have `type="module"` attribute
- Check that all JavaScript files use proper ES6 import/export syntax
- Verify browser supports ES6 modules (Chrome 61+, Firefox 60+, Safari 10.1+)
- Clear browser cache and refresh page

#### Security Policy Violations

**Symptoms**: Content Security Policy (CSP) blocking resources
**Solutions**:

- Check that trusted domains are whitelisted in `utils/security.js`
- Verify external CDNs are included in CSP directives
- Ensure local resources are served from same origin
- Review browser console for specific CSP violation details

#### Rate Limiting Issues

**Symptoms**: "Too Many Requests" (429) errors during streaming
**Solutions**:

- Check if running on localhost (should automatically skip rate limits)
- Verify endpoint-specific rate limits in `utils/security.js`
- Ensure streaming endpoints have appropriate high limits
- Consider adjusting rate limit window and thresholds for your use case

### Error Codes

| Code    | Meaning               | Solution                        |
| ------- | --------------------- | ------------------------------- |
| **503** | Resource not ready    | Wait for more download progress |
| **404** | Video file not found  | Check magnet link validity      |
| **416** | Range not satisfiable | Check HTTP range header format  |
| **429** | Too many requests     | Implement request throttling    |
| **500** | Server error          | Check server logs and restart   |

### Debug Mode

Enable detailed logging by setting `DEBUG_MODE = true` in `configs/all.config.js`:

```javascript
// In configs/all.config.js
export const PLAYER_CONFIG = {
  DEBUG_MODE: true, // Enable debug logging
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

## 🔧 Development & Deployment

### Development Commands

```bash
# Development with auto-reload
npm run dev                    # Web server with nodemon
npm run electron-dev           # Desktop app with DevTools

# Standard launch
npm start                      # Web server only
npm run electron              # Desktop application

# Universal launcher
node launcher.js dev          # Development mode
node launcher.js web          # Web server
node launcher.js electron     # Desktop app
```

### Build & Distribution

```bash
# Build desktop executables
npm run build                 # Full build (installers + ZIP)
npm run electron-pack        # Package only (no installers)

# Build outputs
./out/MKV-Video-Player-win32-x64/     # Windows executable
./out/make/zip/                       # Portable ZIP files
./out/make/squirrel.windows/          # Windows installer
```

### Deployment Options

#### 1. **Desktop Distribution**

- **Portable ZIP**: Extract and run - no installation needed
- **Windows Installer**: Professional installer with auto-update support
- **Cross-platform**: Build for Windows, macOS, and Linux

#### 2. **Web Server Deployment**

- **Local Development**: `npm start` on localhost:3000
- **Production Server**: Deploy to VPS/cloud with reverse proxy
- **Docker**: Containerized deployment (Dockerfile not included)

#### 3. **Hybrid Approach**

- Use desktop app for personal use
- Deploy web version for sharing/remote access
- Same codebase, different deployment methods

### Configuration

Key configuration files:

- [`package.json`](package.json) - Dependencies and build settings
- [`configs/all.config.js`](configs/all.config.js) - Application configuration
- [`electron-main.js`](electron-main.js) - Desktop app settings
- [`app.js`](app.js) - Web server configuration

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

- **Electron** - Cross-platform desktop application framework with native system integration
- **WebTorrent** - P2P streaming technology with optimized piece selection
- **Plyr** - Modern video player interface with custom control integration
- **SubtitlesOctopus** - Advanced subtitle rendering with performance optimizations
- **FFmpeg** - Video processing, subtitle extraction, and audio track analysis
- **Express.js** - Web application framework with efficient routing
- **The open-source community** - For continuous inspiration, performance insights, and support

---

_Star ⭐ this repository if you find it useful!_
