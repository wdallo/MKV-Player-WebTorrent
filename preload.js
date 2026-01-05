const { contextBridge, ipcRenderer } = require("electron");

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // System information
  platform: process.platform,

  // IPC communication
  onShowMagnetInput: (callback) => {
    ipcRenderer.on("show-magnet-input", callback);
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Console functionality
  onConsoleLog: (callback) => {
    ipcRenderer.on("console-log", callback);
  },

  onShowConsoleTab: (callback) => {
    ipcRenderer.on("show-console-tab", callback);
  },

  getConsoleLogs: () => {
    return ipcRenderer.invoke("get-console-logs");
  },

  executeCommand: (command) => {
    return ipcRenderer.invoke("execute-command", command);
  },

  // Application info
  getVersion: () => {
    return process.env.npm_package_version || "1.0.0";
  },

  // Utility functions
  isElectron: () => true,
  isDev: () => process.env.ELECTRON_IS_DEV === "1",
});
