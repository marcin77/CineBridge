const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,

  // Scraper
  startScraping:      (credentials) => ipcRenderer.invoke("scraper:start", credentials),
  stopScraping:       ()            => ipcRenderer.invoke("scraper:stop"),
  getScraperStatus:   ()            => ipcRenderer.invoke("scraper:status"),
  clearScraperData:   ()            => ipcRenderer.invoke("scraper:clear"),
  onScraperProgress:  (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on("scraper:progress", listener);
    return () => ipcRenderer.removeListener("scraper:progress", listener);
  },
  onScraperDone:      (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on("scraper:done", listener);
    return () => ipcRenderer.removeListener("scraper:done", listener);
  },
  onScraperError:     (cb) => {
    const listener = (_, err) => cb(err);
    ipcRenderer.on("scraper:error", listener);
    return () => ipcRenderer.removeListener("scraper:error", listener);
  },

  // Credentials
  saveCredentials:    (email, password) => ipcRenderer.invoke("credentials:save", { email, password }),
  loadCredentials:    ()                => ipcRenderer.invoke("credentials:load"),
  clearCredentials:   ()                => ipcRenderer.invoke("credentials:clear"),

  // Auto-updater
  checkForUpdates:    () => ipcRenderer.invoke("updater:check"),
  downloadUpdate:     () => ipcRenderer.invoke("updater:download"),
  installUpdate:      () => ipcRenderer.invoke("updater:install"),

  onUpdaterChecking: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("updater:checking", listener);
    return () => ipcRenderer.removeListener("updater:checking", listener);
  },
  onUpdaterAvailable: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on("updater:available", listener);
    return () => ipcRenderer.removeListener("updater:available", listener);
  },
  onUpdaterNotAvailable: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("updater:not-available", listener);
    return () => ipcRenderer.removeListener("updater:not-available", listener);
  },
  onUpdaterProgress: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on("updater:progress", listener);
    return () => ipcRenderer.removeListener("updater:progress", listener);
  },
  onUpdaterDownloaded: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on("updater:downloaded", listener);
    return () => ipcRenderer.removeListener("updater:downloaded", listener);
  },
  onUpdaterError: (cb) => {
    const listener = (_, data) => cb(data);
    ipcRenderer.on("updater:error", listener);
    return () => ipcRenderer.removeListener("updater:error", listener);
  },

});