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
});