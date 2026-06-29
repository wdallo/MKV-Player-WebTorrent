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

import contextMenu from "electron-context-menu";

contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showInspectElement: false,
  showCopyImage: false,
  showCopyLink: false,
  showSelectAll: false,
  shouldShowMenu: (event, params) => params.isEditable,
});

process.env.APP_VERSION = app.getVersion();
// Support __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to inject a clean error screen directly into your view component
function injectWebviewError(viewInstance) {
  // Simple, universal modern HTML structure matching your app's dark aesthetic
  const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Connection Failed</title>
      <style>
        body {
          background-color: #121212;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
          padding: 20px;
          box-sizing: border-box;
        }
        .container {
          max-width: 500px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 12px;
          color: #ff4d4f;
          font-weight: 600;
        }
        p {
          font-size: 15px;
          color: #a0a0a0;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .retry-btn {
          background-color: #0091ff;
          color: white;
          border: none;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .retry-btn:hover {
          background-color: #007be6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Connection Failed</h1>
        <p>The domain name could not be resolved. The page does not exist or is not responding. Please check your spelling or internet settings.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry Connection</button>
      </div>
    </body>
    </html>
  `;

  // Encode the markup cleanly to feed it directly as a virtual application URL
  const encodedHtml = Buffer.from(errorHtml).toString("base64");

  if (viewInstance && viewInstance.webContents) {
    viewInstance.webContents.loadURL(`data:text/html;base64,${encodedHtml}`);
  }
}

/// Override console.error to filter out Electron internal GUEST_VIEW and navigation errors noise
const originalConsoleError = console.error;

console.error = function (...args) {
  const errorMessage = args.join(" ");
  // FILTER [1]:
  // Silence standard webview manager internal abort traces
  const isGuestViewAbort =
    errorMessage.includes("GUEST_VIEW_MANAGER_CALL") &&
    (errorMessage.includes("ERR_ABORTED") ||
      errorMessage.includes("ERR_FAILED") ||
      errorMessage.includes("-2"));

  // FILTER [2]:
  // Catch structural browser loading failure exceptions stemming from heavy proxy blocks
  const isNativeNavigationFailure =
    errorMessage.includes(
      "Error occurred in handler for 'GUEST_VIEW_MANAGER_CALL'",
    ) ||
    errorMessage.includes("rejectAndCleanup") ||
    errorMessage.includes("thepiratebay.org");

  // FILTER [3]:
  // Catch exact domain resolution failures (ERR_NAME_NOT_RESOLVED / -105)
  const isDnsFailure =
    errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
    errorMessage.includes("-105");
  if (isDnsFailure) {
    // Trigger the custom error UI block immediately
    dialog.showErrorBox(
      "Connection Failed",
      "The domain name could not be resolved. The page does not exist or is not responding.",
    );
    // Suppress from printing to the terminal to keep logs pristine
    return;
  }
  if (isGuestViewAbort || isNativeNavigationFailure) {
    // Intentionally silence these exact native internal navigation errors to keep terminal logs pristine
    return;
  }
  // Pass through all other legitimate developer backend errors as normal
  originalConsoleError.apply(console, args);
};
// Catch and silence global internal Electron promise cancellations and network frame drops
process.on("unhandledRejection", (reason) => {
  if (reason) {
    const reasonStr = String(reason);
    // Check for DNS failure variations inside promises as well
    const isDnsFailure =
      reason.code === "ERR_NAME_NOT_RESOLVED" ||
      reason.errno === -105 ||
      reasonStr.includes("ERR_NAME_NOT_RESOLVED") ||
      reasonStr.includes("-105");

    if (isDnsFailure) {
      dialog.showErrorBox(
        "Connection Failed",
        "The domain name could not be resolved. The page does not exist or is not responding.",
      );
      return;
    }

    // Check all possible variations of the Chromium cancellation and failure error properties
    const isNetworkCancel =
      reason.code === "ERR_ABORTED" ||
      reason.code === "ERR_FAILED" ||
      reason.errno === -3 ||
      reason.errno === -2 ||
      reasonStr.includes("ERR_ABORTED") ||
      reasonStr.includes("ERR_FAILED") ||
      reasonStr.includes("-3") ||
      reasonStr.includes("-2") ||
      reasonStr.includes("thepiratebay.org");

    if (isNetworkCancel) {
      // Ignore background network drop cancellations
      return;
    }
  }
  // Log all other legitimate backend unhandled exceptions as normal
  originalConsoleError.apply(console, ["Unhandled Rejection:", reason]);
});

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

  // Intercept webview attachment to block popup windows from causing cancellations
  mainWindow.webContents.on("did-attach-webview", (event, webContents) => {
    webContents.setWindowOpenHandler(() => {
      console.log("Blocked a pop-up window from webview");
      return { action: "deny" };
    });
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

  // Handle external links from main window
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

    // Block pop-up windows inside the BrowserView as well to avoid cancellations
    browserView.webContents.setWindowOpenHandler(() => {
      console.log("Blocked a pop-up window from BrowserView");
      return { action: "deny" };
    });

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
      if (typeof injectMagnetButtons === "function") injectMagnetButtons();
    });

    // Also inject on navigation
    browserView.webContents.on("did-navigate-in-page", () => {
      if (typeof injectMagnetButtons === "function") injectMagnetButtons();
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

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Complete initialization hook
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
