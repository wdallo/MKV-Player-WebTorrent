import {
  app,
  BrowserWindow,
  BrowserView,
  Menu,
  dialog,
  shell,
  ipcMain,
} from "electron";
import { fileURLToPath } from "url";
import path from "path";
import { spawn } from "child_process";
process.env.APP_VERSION = app.getVersion();
// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object
let mainWindow;
let browserView = null;
let serverProcess = null;
const PORT = process.env.PORT || 3000;
const isDev = process.env.ELECTRON_IS_DEV === "1";

// Enable live reload for Electron in development
if (isDev) {
  try {
    require("electron-reload")(__dirname, {
      electron: path.join(__dirname, "..", "node_modules", ".bin", "electron"),
      hardResetMethod: "exit",
    });
  } catch (_) {
    console.log("electron-reload not available");
  }
}

async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.resolve(__dirname, "favicon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      webviewTag: true, // Enable <webview> tag
      preload: path.join(__dirname, "preload.js"), // We'll create this
    },
    show: false, // Don't show until ready
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#1a1a1a",
    title: "MKV Video Player",
  });

  // Wait for window to be ready before showing
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // Focus on the window on creation
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  try {
    await startServer();
    await mainWindow.loadURL(`http://localhost:${PORT}`);
  } catch (err) {
    const errorPath = path.join(__dirname, "error.html");
    const errorUrl = `file://${errorPath}?error=${encodeURIComponent(err && err.message ? err.message : String(err))}`;
    await mainWindow.loadURL(errorUrl);
  }

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
    stopServer();
  });

  // Handle window resize to adjust BrowserView
  mainWindow.on("resize", () => {
    if (browserView) {
      const [width, height] = mainWindow.getContentSize();
      const topOffset = 200;
      browserView.setBounds({
        x: 0,
        y: topOffset,
        width: width,
        height: height - topOffset,
      });
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Create application menu
  createMenu();
}

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      // Start the Express server as a child process
      serverProcess = spawn("node", ["app.js"], {
        cwd: __dirname,
        env: { ...process.env, PORT: PORT, ELECTRON: "1" },
        stdio: isDev ? "inherit" : "ignore",
      });

      serverProcess.on("error", (err) => {
        console.error("Failed to start server:", err);
        reject(err);
      });

      // Wait a moment for the server to start
      setTimeout(() => {
        resolve();
      }, 2000);
    } catch (error) {
      reject(error);
    }
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(`http://localhost:${PORT}/desktop/settings`);
            }
          },
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.reload();
          },
        },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => {
            mainWindow.webContents.reloadIgnoringCache();
          },
        },
        { type: "separator" },
        {
          role: "quit",
        },
      ],
    },

    {
      label: "Help",
      submenu: [
        {
          label: "About MKV Video Player",
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: "MKV Video Player",
              detail:
                "A professional video player with torrent streaming and subtitle support.\n\nDeveloped by wdallo.\nGitHub: https://github.com/wdallo/MKV-Player-WebTorrent",
            });
          },
        },
        {
          label: "Documentation",
          click: async () => {
            shell.openExternal(
              "https://github.com/wdallo/MKV-Player-WebTorrent#readme",
            );
          },
        },
        {
          label: "Report Issue",
          click: async () => {
            shell.openExternal(
              "https://github.com/wdallo/MKV-Player-WebTorrent/issues",
            );
          },
        },
        {
          label: "GitHub Repo",
          click: async () => {
            shell.openExternal(
              "https://github.com/wdallo/MKV-Player-WebTorrent",
            );
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle IPC messages
ipcMain.handle("app-version", () => {
  return app.getVersion();
});

ipcMain.handle("show-message-box", async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle("show-open-dialog", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle("show-save-dialog", async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Handle browser view for embedded browsing
ipcMain.handle("load-browser-url", async (event, url) => {
  if (!mainWindow) return { success: false, error: "Window not available" };

  try {
    // Create browser view if it doesn't exist
    if (!browserView) {
      browserView = new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      mainWindow.setBrowserView(browserView);
    }

    // Initial bounds - will be updated by renderer with exact offset
    const [width, height] = mainWindow.getContentSize();
    browserView.setBounds({
      x: 0,
      y: 0,
      width: width,
      height: height,
    });
    browserView.setAutoResize({
      width: true,
      height: true,
    });

    // Load URL
    await browserView.webContents.loadURL(url);

    // Listen for console messages from injected script
    browserView.webContents.on(
      "console-message",
      (event, level, message, line, sourceId) => {
        if (message.startsWith("MKV_PLAY:")) {
          const magnetUrl = message.replace("MKV_PLAY:", "");
          if (mainWindow) {
            mainWindow.loadURL(
              `http://localhost:${PORT}/player?url=${encodeURIComponent(magnetUrl)}`,
            );
          }
        }
      },
    );

    // Inject script to add play buttons next to magnet links
    browserView.webContents.on("did-finish-load", () => {
      injectMagnetButtons();
    });

    // Also inject on navigation
    browserView.webContents.on("did-navigate-in-page", () => {
      injectMagnetButtons();
    });

    // Intercept magnet links - prevent OS from opening them
    browserView.webContents.on("will-navigate", (event, navigationUrl) => {
      if (navigationUrl.startsWith("magnet:")) {
        event.preventDefault();
        if (mainWindow) {
          mainWindow.loadURL(
            `http://localhost:${PORT}/player?url=${encodeURIComponent(navigationUrl)}`,
          );
        }
      }
    });

    // Also handle new-window events for magnet links
    browserView.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("magnet:")) {
        if (mainWindow) {
          mainWindow.loadURL(
            `http://localhost:${PORT}/player?url=${encodeURIComponent(url)}`,
          );
        }
        return { action: "deny" };
      }
      return { action: "deny" };
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Function to inject play buttons next to magnet links
function injectMagnetButtons() {
  if (!browserView) return;

  const injectionScript = `
    (function() {
      // Remove existing buttons first
      document.querySelectorAll('.mkv-play-btn').forEach(btn => btn.remove());
      
      // Add CSS for play buttons
      if (!document.getElementById('mkv-play-style')) {
        const style = document.createElement('style');
        style.id = 'mkv-play-style';
        style.textContent = \`
          .mkv-play-btn {
            display: inline-block;
            margin-left: 8px;
            padding: 4px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            vertical-align: middle;
          }
          .mkv-play-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
          }
          .mkv-play-btn:active {
            transform: translateY(0);
          }
        \`;
        document.head.appendChild(style);
      }
      
      // Find all magnet links and add play buttons
      const magnetLinks = document.querySelectorAll('a[href^="magnet:"]');
      
      magnetLinks.forEach(link => {
        // Skip if button already exists
        if (link.nextElementSibling && link.nextElementSibling.classList.contains('mkv-play-btn')) {
          return;
        }
        
        const playBtn = document.createElement('button');
        playBtn.className = 'mkv-play-btn';
        playBtn.innerHTML = '▶ Play';
        playBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          const magnetUrl = link.getAttribute('href');
          
          // Send via console message to avoid OS intercepting magnet URL
          console.log('MKV_PLAY:' + magnetUrl);
        };
        
        // Insert after the link
        link.parentNode.insertBefore(playBtn, link.nextSibling);
      });
      
      // Monitor for dynamically added magnet links
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              const newMagnetLinks = node.querySelectorAll ? node.querySelectorAll('a[href^="magnet:"]') : [];
              newMagnetLinks.forEach(link => {
                if (!link.nextElementSibling || !link.nextElementSibling.classList.contains('mkv-play-btn')) {
                  const playBtn = document.createElement('button');
                  playBtn.className = 'mkv-play-btn';
                  playBtn.innerHTML = '▶ Play';
                  playBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const magnetUrl = link.getAttribute('href');
                    console.log('MKV_PLAY:' + magnetUrl);
                  };
                  link.parentNode.insertBefore(playBtn, link.nextSibling);
                }
              });
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    })();
  `;

  browserView.webContents.executeJavaScript(injectionScript).catch((err) => {
    console.error("Failed to inject script:", err);
  });
}

// Handle custom protocol from injected buttons
ipcMain.handle("load-magnet-from-browser", async (event, magnetUrl) => {
  if (mainWindow) {
    // Load the player with the magnet URL
    mainWindow.loadURL(
      `http://localhost:${PORT}/player?url=${encodeURIComponent(magnetUrl)}`,
    );
  }
  return { success: true };
});

ipcMain.handle("close-browser-view", async () => {
  if (browserView && mainWindow) {
    mainWindow.removeBrowserView(browserView);
    browserView.webContents.close();
    browserView = null;
  }
  return { success: true };
});

ipcMain.handle("browser-navigate", async (event, action) => {
  if (!browserView) return { success: false };

  try {
    switch (action) {
      case "back":
        if (browserView.webContents.canGoBack()) {
          browserView.webContents.goBack();
        }
        break;
      case "forward":
        if (browserView.webContents.canGoForward()) {
          browserView.webContents.goForward();
        }
        break;
      case "refresh":
        browserView.webContents.reload();
        break;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-external", async (event, url) => {
  shell.openExternal(url);
  return { success: true };
});

// Get toolbar height from renderer
ipcMain.handle(
  "set-browser-view-offset",
  async (event, offset, placeholderHeight) => {
    if (browserView && mainWindow) {
      const [width] = mainWindow.getContentSize();
      // Use placeholderHeight if provided
      const viewHeight = placeholderHeight || 600; // Default fallback
      browserView.setBounds({
        x: 0,
        y: offset,
        width: width,
        height: viewHeight,
      });
    }
    return { success: true };
  },
);

// App event handlers
app.whenReady().then(async () => {
  // Set app user model ID for Windows
  if (process.platform === "win32") {
    app.setAppUserModelId("com.wdallo.mkv-video-player");
  }
  await createWindow();

  app.on("activate", async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopServer();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer();
});

// Handle certificate errors
app.on(
  "certificate-error",
  (event, webContents, url, error, certificate, callback) => {
    if (isDev) {
      // In development, ignore certificate errors
      event.preventDefault();
      callback(true);
    } else {
      // In production, use default behavior
      callback(false);
    }
  },
);

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (navigationEvent, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle protocol for deep linking (optional)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("mkv-player", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("mkv-player");
}

// Handle restart-app signal
ipcMain.on("restart-app", () => {
  app.relaunch();
  app.exit();
});
