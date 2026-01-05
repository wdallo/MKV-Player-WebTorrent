const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

// Keep a global reference of the window object
let mainWindow;
let serverProcess;
const PORT = 3000;
let logBuffer = []; // Store logs for console tab

// Enhanced logging function
function logToConsole(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;

  // Store in buffer for console tab
  logBuffer.push({
    timestamp,
    level,
    message: fullMessage,
    args,
  });

  // Keep buffer size manageable
  if (logBuffer.length > 1000) {
    logBuffer = logBuffer.slice(-800);
  }

  // Log to console
  try {
    console[level](fullMessage, ...args);
  } catch (e) {
    console.log(fullMessage, ...args);
  }

  // Send to renderer if window exists
  try {
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("console-log", {
        timestamp,
        level,
        message: fullMessage,
        args,
      });
    }
  } catch (e) {
    // Ignore renderer communication errors during startup
  }
}

// Check if we're in development mode
const isDev =
  process.env.ELECTRON_IS_DEV === "1" || process.argv.includes("--dev");

function createWindow() {
  try {
    logToConsole("info", "[LAUNCH] Creating main window...");
    logToConsole("info", "[LAUNCH] Development mode:", isDev);
    logToConsole("info", "[LAUNCH] Platform:", process.platform);
    logToConsole("info", "[LAUNCH] Node version:", process.version);
    logToConsole(
      "info",
      "[LAUNCH] Electron version:",
      process.versions.electron
    );
    logToConsole("info", "[LAUNCH] Working directory:", process.cwd());
    logToConsole("info", "[LAUNCH] App path:", app.getAppPath());

    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        preload: path.join(__dirname, "preload.js"),
      },
      show: false,
      titleBarStyle: "default",
    });

    logToConsole("info", "[LAUNCH] Main window created successfully");
    logToConsole(
      "info",
      "[LAUNCH] Preload script path:",
      path.join(__dirname, "preload.js")
    );
    logToConsole("info", "[LAUNCH] Window ID:", mainWindow.id);

    // Start the Express server
    logToConsole("info", "[LAUNCH] Starting Express server...");
    logToConsole("info", "[LAUNCH] Target port:", PORT);
    startServer();
  } catch (error) {
    console.error("[ERROR] Failed to create window:", error);
    app.quit();
    return;
  }

  // Wait a moment for server to start, then load the app
  setTimeout(async () => {
    logToConsole("info", "Attempting to connect to server...");

    // Check if server is responding before loading
    let serverReady = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!serverReady && attempts < maxAttempts) {
      try {
        // Try the health endpoint first, then root
        const response = await Promise.race([
          fetch(`http://localhost:${PORT}/health`),
          fetch(`http://localhost:${PORT}/`),
        ]).catch(() => null);

        if (response && response.ok) {
          console.log("Server is responding!");
          serverReady = true;
        } else {
          console.log(
            `Server not ready, attempt ${attempts + 1}/${maxAttempts}`
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.warn("Could not check server status:", error.message);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      attempts++;
    }

    if (!serverReady) {
      console.error("Server failed to start after multiple attempts");
      console.error("App will show error page");

      // Load an error page instead
      mainWindow.loadURL(
        `data:text/html,<html><body><h1>Server Failed to Start</h1><p>The MKV Player server could not be started. Please check the console for errors.</p></body></html>`
      );
    } else {
      mainWindow.loadURL(`http://localhost:${PORT}`);
    }

    // Show window when ready
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();

      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    });

    // Handle failed loads
    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error("Failed to load page:", errorCode, errorDescription);
        console.error("URL that failed:", mainWindow.webContents.getURL());

        // Show error page with more details
        const errorPage = `
          <html>
            <head><title>MKV Player - Failed to Load</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #d32f2f;">Failed to Load MKV Player</h1>
                <p><strong>Error Code:</strong> ${errorCode}</p>
                <p><strong>Error Description:</strong> ${errorDescription}</p>
                <p><strong>Attempted URL:</strong> http://localhost:${PORT}</p>
                <hr>
                <h3>Troubleshooting:</h3>
                <ul>
                  <li>The server may still be starting up - please wait a few seconds and the app should load automatically</li>
                  <li>Check if port ${PORT} is already in use by another application</li>
                  <li>Try restarting the application</li>
                </ul>
                <p><small>If this problem persists, please check the console for additional error details.</small></p>
              </div>
            </body>
          </html>
        `;
        mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorPage)}`);
      }
    );
  }, 5000);

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== `http://localhost:${PORT}`) {
      event.preventDefault();
    }
  });
}

function startServer() {
  console.log("[SERVER] Starting Express server...");
  console.log("[SERVER] Is packaged:", app.isPackaged);
  console.log("[SERVER] Resource path:", app.getAppPath());
  console.log("[SERVER] __dirname:", __dirname);

  if (app.isPackaged) {
    // For packaged apps, always use process spawning for better isolation
    console.log("[SERVER] Using packaged app server startup");
    startServerProcess();
  } else {
    // For development, try direct import first
    console.log("[SERVER] Using development server startup");
    try {
      import(path.join(__dirname, "app.js"))
        .then(() => {
          console.log("[SERVER] Development server started successfully");
        })
        .catch((error) => {
          console.error("[SERVER] Failed to import server in dev mode:", error);
          startServerProcess();
        });
    } catch (error) {
      console.error("[SERVER] Error starting dev server:", error);
      startServerProcess();
    }
  }
}

function startServerProcess() {
  console.log("[SERVER] Falling back to server process spawning...");
  console.log("[SERVER] Process platform:", process.platform);
  console.log("[SERVER] Process architecture:", process.arch);

  const isPackaged = app.isPackaged;
  let serverPath, cwd;

  if (isPackaged) {
    console.log("[SERVER] Configuring for packaged application");
    // For packaged app, try multiple possible locations
    const possiblePaths = [
      path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "electron-launcher.cjs"
      ),
      path.join(process.resourcesPath, "electron-launcher.cjs"),
      path.join(__dirname, "electron-launcher.cjs"),
    ];

    console.log(
      "[SERVER] Searching for electron-launcher.cjs in paths:",
      possiblePaths
    );
    for (const possiblePath of possiblePaths) {
      console.log("[SERVER] Checking path:", possiblePath);
      if (require("fs").existsSync(possiblePath)) {
        serverPath = possiblePath;
        cwd = path.dirname(serverPath);
        console.log("[SERVER] Found electron-launcher.cjs at:", serverPath);
        break;
      }
    }

    if (!serverPath) {
      console.error(
        "Could not find electron-launcher.cjs in any expected location"
      );
      console.error("Checked paths:", possiblePaths);
      return;
    }
  } else {
    // For development, use electron launcher
    console.log("[SERVER] Configuring for development environment");
    cwd = __dirname;
    serverPath = path.join(__dirname, "electron-launcher.cjs");
    console.log("[SERVER] Development server path:", serverPath);
  }

  console.log("Server CWD:", cwd);
  console.log("Server Path:", serverPath);
  console.log("Is Packaged:", isPackaged);
  console.log("Process Resources Path:", process.resourcesPath);
  console.log("__dirname:", __dirname);

  // Check if server file exists
  if (!require("fs").existsSync(serverPath)) {
    console.error("Server file not found:", serverPath);

    // List files in the directory for debugging
    const dir = path.dirname(serverPath);
    if (require("fs").existsSync(dir)) {
      console.log("Files in", dir, ":");
      console.log(require("fs").readdirSync(dir));
    }
    return;
  }

  console.log("Found server file, starting process...");
  logToConsole("info", "[SERVER] Starting server process...");

  try {
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: cwd,
      stdio: "pipe", // Always pipe to capture output for console
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    });

    console.log("Server process started with PID:", serverProcess.pid);
    logToConsole(
      "info",
      `[SERVER] Server process started with PID: ${serverProcess.pid}`
    );

    serverProcess.on("error", (error) => {
      const errorMsg = `Failed to start server: ${error.message}`;
      console.error(errorMsg);
      logToConsole("error", `[SERVER] ${errorMsg}`);
      // Show error dialog to user
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
          alert('${errorMsg}');
        `);
      }
    });

    serverProcess.on("exit", (code) => {
      const exitMsg = `Server process exited with code ${code}`;
      console.log(exitMsg);
      logToConsole("info", `[SERVER] ${exitMsg}`);
      if (code !== 0 && code !== null) {
        const errorMsg = `Server exited with non-zero code: ${code}`;
        console.error(errorMsg);
        logToConsole("error", `[SERVER] ${errorMsg}`);
      }
    });

    // Handle stdout and stderr for both dev and packaged modes
    if (serverProcess.stdout && serverProcess.stderr) {
      serverProcess.stdout.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log("Server stdout:", output);
          logToConsole("info", `[SERVER] ${output}`);
        }
      });

      serverProcess.stderr.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error("Server stderr:", output);
          logToConsole("error", `[SERVER] ${output}`);
        }
      });
    }
  } catch (error) {
    console.error("Error spawning server process:", error);
  }
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Magnet Link",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            // Send message to renderer to show magnet input
            mainWindow.webContents.send("show-magnet-input");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Show Console",
          accelerator: "F12",
          click: () => {
            mainWindow.webContents.send("show-console-tab");
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator:
            process.platform === "darwin" ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About MKV Video Player",
          click: () => {
            shell.openExternal(
              "https://github.com/wdallo/MKV-Player-WebTorrent"
            );
          },
        },
      ],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for console functionality
ipcMain.handle("get-console-logs", () => {
  logToConsole("info", "[IPC] Console logs requested");
  return logBuffer;
});

ipcMain.handle("execute-command", async (event, command) => {
  logToConsole("info", `[IPC] Executing command: ${command}`);

  try {
    // Simple command execution - you can expand this
    if (command === "clear") {
      logBuffer = [];
      return { success: true, output: "Console cleared" };
    }

    if (command === "help") {
      return {
        success: true,
        output:
          "Available commands:\n- clear: Clear console\n- help: Show this help\n- status: Show app status\n- logs: Show recent logs",
      };
    }

    if (command === "status") {
      return {
        success: true,
        output: `App Status:\n- Version: ${app.getVersion()}\n- Platform: ${process.platform}\n- Server Port: ${PORT}\n- Development Mode: ${isDev}`,
      };
    }

    if (command === "logs") {
      const recentLogs = logBuffer
        .slice(-10)
        .map((log) => log.message)
        .join("\n");
      return { success: true, output: recentLogs };
    }

    return { success: false, output: `Unknown command: ${command}` };
  } catch (error) {
    logToConsole("error", "[IPC] Command execution error:", error);
    return { success: false, output: `Error: ${error.message}` };
  }
});

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App event handlers
  app
    .whenReady()
    .then(() => {
      logToConsole("info", "[LAUNCH] App is ready, initializing...");
      logToConsole("info", "[LAUNCH] App name:", app.getName());
      logToConsole("info", "[LAUNCH] App version:", app.getVersion());
      logToConsole("info", "[LAUNCH] User data path:", app.getPath("userData"));
      logToConsole("info", "[LAUNCH] Logs path:", app.getPath("logs"));

      createWindow();
      createMenu();

      logToConsole("info", "[LAUNCH] Window and menu created successfully");

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    })
    .catch((error) => {
      console.error("[ERROR] App initialization failed:", error);
      app.quit();
    });
}

app.on("window-all-closed", () => {
  // Kill the server process
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Kill the server process
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});
