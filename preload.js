const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  loadBrowserUrl: (url) => ipcRenderer.invoke("load-browser-url", url),
  closeBrowserView: () => ipcRenderer.invoke("close-browser-view"),
  browserNavigate: (action) => ipcRenderer.invoke("browser-navigate", action),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  setBrowserViewOffset: (offset, height) =>
    ipcRenderer.invoke("set-browser-view-offset", offset, height),
});
