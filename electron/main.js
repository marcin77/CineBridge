/**
 * Główny proces Electrona dla CineBridge.
 * Docelowa ścieżka w repo: electron/main.js
 *
 * Co robi:
 *  1. W trybie produkcyjnym (spakowana appka) odpala wbudowaną bazę
 *     Postgres (embedded-postgres) w katalogu danych użytkownika.
 *  2. Odpala serwer Next.js zbudowany w trybie "standalone" jako osobny
 *     proces Node (server.js), przekazując mu DATABASE_URL do bazy z pkt 1.
 *  3. Otwiera okno Electrona i ładuje adres lokalnego serwera.
 *
 * W trybie deweloperskim (`npm run electron:dev`) zakłada, że
 * `next dev` już działa na porcie 3000 (patrz skrypt "electron:dev").
 */

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");

const isDev = !app.isPackaged;
const PORT = Number(process.env.CINEBRIDGE_PORT || 3456);
const PG_PORT = Number(process.env.CINEBRIDGE_PG_PORT || 54329);

let mainWindow = null;
let nextProcess = null;
let pgInstance = null;

/** Uruchamia (lub w dev pomija) wbudowaną bazę Postgres i zwraca connection string. */
async function startDatabase() {
  if (isDev) {
    // W trybie dev korzystamy z bazy skonfigurowanej w .env (np. lokalny Docker/Postgres).
    return process.env.DATABASE_URL || "";
  }

  const EmbeddedPostgres = require("embedded-postgres");
  const dataDir = path.join(app.getPath("userData"), "pgdata");
  const isFirstRun = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

  pgInstance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "cinebridge",
    password: "cinebridge",
    port: PG_PORT,
    persistent: true,
    onLog: (msg) => console.log("[postgres]", msg),
    onError: (msg) => console.error("[postgres:err]", msg),
  });

  await pgInstance.initialise();
  await pgInstance.start();

  if (isFirstRun) {
    await pgInstance.createDatabase("cinebridge");
  }

  return `postgres://cinebridge:cinebridge@127.0.0.1:${PG_PORT}/cinebridge`;
}

/** Odpytuje podany adres HTTP aż odpowie (lub przekroczy timeout). */
function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout czekania na serwer: ${url}`));
          return;
        }
        setTimeout(check, 300);
      });
    };
    check();
  });
}

/** Odpala zbudowany serwer Next.js (tryb standalone) jako osobny proces. */
async function startNextServer(databaseUrl) {
  if (isDev) return; // w dev serwer uruchamia `next dev` (patrz package.json)

  const serverPath = path.join(process.resourcesPath, "app-standalone", "server.js");

  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Nie znaleziono ${serverPath}. Upewnij się, że next.config.ts ma ` +
        `"output: 'standalone'" i że uruchomiono "npm run electron:prepare" przed buildem.`
    );
  }

  nextProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
    windowsHide: true,
  });

  nextProcess.on("exit", (code) => {
    console.log("Serwer Next.js zakończył działanie, kod:", code);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = isDev ? "http://localhost:3000" : `http://127.0.0.1:${PORT}`;
  await waitForServer(url);
  await mainWindow.loadURL(url);

  // Linki zewnętrzne (np. do Trakt.tv) otwieramy w domyślnej przeglądarce,
  // a nie w oknie aplikacji.
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const databaseUrl = await startDatabase();
    await startNextServer(databaseUrl);
    await createWindow();
  } catch (err) {
    console.error("Nie udało się uruchomić CineBridge:", err);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (event) => {
  if (nextProcess || pgInstance) {
    event.preventDefault();
    try {
      if (nextProcess) nextProcess.kill();
    } catch (_) {}
    try {
      if (pgInstance) await pgInstance.stop();
    } catch (_) {}
    nextProcess = null;
    pgInstance = null;
    app.quit();
  }
});
