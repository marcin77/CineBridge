/**
 * Preload script Electrona.
 * Docelowa ścieżka w repo: electron/preload.js
 *
 * Uruchamiany w izolowanym kontekście (contextIsolation: true),
 * udostępnia stronie internetowej minimalne, bezpieczne API,
 * dzięki któremu front-end może rozpoznać, że działa w wersji desktopowej.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("cineBridgeDesktop", {
  isElectron: true,
  platform: process.platform,
});
