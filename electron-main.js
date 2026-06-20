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
// Override console.error to filter out Electron internal GUEST_VIEW noise
const originalConsoleError = console.error;

console.error = function (...args) {
  const errorMessage = args.join(" ");

  // Check if the error message contains the internal webview manager abort trace
  if (
    errorMessage.includes("GUEST_VIEW_MANAGER_CALL") &&
    errorMessage.includes("ERR_ABORTED")
  ) {
    // Silence this exact error log
    return;
  }

  // Pass through all other legitimate errors
  originalConsoleError.apply(console, args);
};
// Catch and silence global internal Electron promise cancellations (-3 / ERR_ABORTED)
process.on("unhandledRejection", (reason) => {
  if (reason) {
    // Check all possible variations of the Chromium cancellation error properties
    const isAbort =
      reason.code === "ERR_ABORTED" ||
      reason.errno === -3 ||
      String(reason).includes("ERR_ABORTED") ||
      String(reason).includes("-3");

    if (isAbort) {
      // Intentionally ignore internal browser cancellations to keep the terminal logs clean
      return;
    }
  }

  // Log all other legitimate backend unhandled exceptions as normal
  console.error("Unhandled Rejection:", reason);
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
