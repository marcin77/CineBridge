const { app, BrowserWindow, shell, ipcMain, safeStorage } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let nextServerProcess = null;
const PORT = 3000;

// ─── Sciezki ──────────────────────────────────────────────────────────────────
function getDatabasePath() {
  return path.join(app.getPath("userData"), "cinebridge.db");
}

function getMigrationsPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "drizzle")
    : path.join(__dirname, "..", "drizzle");
}

function getAppDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
}

function getScraperDataDir() {
  return path.join(app.getPath("userData"), "scraper");
}

// ─── Next.js server ───────────────────────────────────────────────────────────
function startProductionServer() {
  return new Promise((resolve, reject) => {
    const nextServerScript = path.join(__dirname, "next-server.js");
    console.log("[Electron] Forkuje proces Next.js:", nextServerScript);

    nextServerProcess = fork(nextServerScript, [], {
      env: {
        ...process.env,
        PORT: String(PORT),
        APP_DIR: getAppDir(),
        DATABASE_PATH: getDatabasePath(),
        MIGRATIONS_PATH: getMigrationsPath(),
      },
      silent: false,
    });

    nextServerProcess.on("message", (msg) => {
      if (msg === "ready") resolve();
    });

    nextServerProcess.on("error", (err) => {
      console.error("[Electron] Blad procesu Next.js:", err);
      reject(err);
    });

    nextServerProcess.on("exit", (code) => {
      console.log("[Electron] Proces Next.js zakonczony, kod:", code);
    });

    waitForServer(resolve, reject);
  });
}

function waitForServer(resolve, reject, attempts = 0) {
  const MAX_ATTEMPTS = 40;
  if (attempts >= MAX_ATTEMPTS) {
    reject(new Error("Next.js server nie odpowiedzial w wyznaczonym czasie"));
    return;
  }
  const req = http.get(`http://localhost:${PORT}`, (res) => {
    if (res.statusCode) resolve();
  });
  req.on("error", () => {
    setTimeout(() => waitForServer(resolve, reject, attempts + 1), 500);
  });
  req.end();
}

function waitForDevServer(resolve, reject, attempts = 0) {
  const MAX_ATTEMPTS = 60;
  if (attempts >= MAX_ATTEMPTS) {
    reject(new Error("Dev server (next dev) nie odpowiedzial"));
    return;
  }
  const req = http.get(`http://localhost:${PORT}`, (res) => {
    if (res.statusCode) resolve();
  });
  req.on("error", () => {
    setTimeout(() => waitForDevServer(resolve, reject, attempts + 1), 500);
  });
  req.end();
}

// ─── Okno aplikacji ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "CineBridge",
    icon: path.join(__dirname, "..", "build", "icons", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    backgroundColor: "#000000",
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── Auto-upload CSV → Next.js API ───────────────────────────────────────────
async function autoUploadCsv(csvContent, csvPath) {
  try {
    const filename = path.basename(csvPath);

    // Uzyj natywnych, globalnych Blob i FormData (Web API dostepne w Node.js 18+)
    // NIE importuj ich z 'buffer' ani z pakietu 'form-data' - to psuje kompatybilnosc z fetch
    const blob = new Blob([csvContent], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("source", "filmweb");

    const res = await fetch(`http://localhost:${PORT}/api/import/upload`, {
      method: "POST",
      body: formData,
      // WAZNE: NIE ustawiaj recznie headers Content-Type -
      // fetch sam doda poprawny boundary dla FormData
    });

    const data = await res.json();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("scraper:progress", {
        phase: "upload",
        message: res.ok
          ? `Import zakończony: ${data.totalItems} pozycji wczytanych do bazy.`
          : `Błąd importu: ${data.error}`,
        uploadResult: data,
      });
    }
  } catch (err) {
    console.error("[main] Auto-upload error:", err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("scraper:progress", {
        phase: "upload_error",
        message: `Błąd automatycznego importu: ${err.message}`,
      });
    }
  }
}

// ─── IPC: Scraper ─────────────────────────────────────────────────────────────
function setupScraperIpc() {
  let scraperRunner = null;
  function getRunner() {
    if (!scraperRunner) {
      scraperRunner = require("./scraper/scraper-runner");
    }
    return scraperRunner;
  }

  ipcMain.handle("scraper:start", async (event, credentials) => {
    const { email, password } = credentials || {};
    if (!email || !password) {
      return { success: false, error: "Brak emaila lub hasla" };
    }

    setImmediate(async () => {
      try {
        const result = await getRunner().runScraper({
          email,
          password,
          mainWindow,
          dataDir: getScraperDataDir(),
        });
        // Auto-upload CSV do Next.js po zakonczeniu
        if (result?.csvContent && result?.csvPath) {
          await autoUploadCsv(result.csvContent, result.csvPath);
        }
      } catch (err) {
        console.error("[Electron] Nieoczekiwany blad scrapera:", err.message);
      }
    });

    return { success: true, message: "Scrapowanie uruchomione" };
  });

  ipcMain.handle("scraper:stop", async () => {
    try {
      const stopped = getRunner().stopScraper();
      return { success: stopped };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("scraper:status", async () => {
    try {
      return getRunner().getLastSync(getScraperDataDir());
    } catch (e) {
      return { lastSync: null, totalItems: 0, running: false, lastProgress: null };
    }
  });

  ipcMain.handle("scraper:getCsvPath", async () => {
    try {
      return getRunner().getCsvPath(getScraperDataDir());
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle("scraper:openFolder", async () => {
    const dataDir = getScraperDataDir();
    if (fs.existsSync(dataDir)) {
      shell.openPath(dataDir);
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle("scraper:clear", async () => {
  try {
    const result = getRunner().clearData(getScraperDataDir());
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

}

// ─── IPC: Credentials (safeStorage) ──────────────────────────────────────────
function setupCredentialsIpc() {
  const CRED_PATH = path.join(app.getPath("userData"), "credentials.enc");

  ipcMain.handle("credentials:save", async (event, { email, password }) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        const data = Buffer.from(JSON.stringify({ email, password }));
        fs.writeFileSync(CRED_PATH, data);
        return { success: true, encrypted: false };
      }

      const data = JSON.stringify({ email, password });
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(CRED_PATH, encrypted);
      return { success: true, encrypted: true };
    } catch (e) {
      console.error("[Electron] Blad zapisu credentials:", e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("credentials:load", async () => {
    try {
      if (!fs.existsSync(CRED_PATH)) return null;

      const fileContent = fs.readFileSync(CRED_PATH);

      if (!safeStorage.isEncryptionAvailable()) {
        return JSON.parse(fileContent.toString());
      }

      const decrypted = safeStorage.decryptString(fileContent);
      return JSON.parse(decrypted);
    } catch (e) {
      console.error("[Electron] Blad odczytu credentials:", e.message);
      return null;
    }
  });

  ipcMain.handle("credentials:clear", async () => {
    try {
      if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH);
      const { clearSession } = require("./scraper/filmweb-auth");
      await clearSession();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    setupScraperIpc();
    setupCredentialsIpc();

    if (app.isPackaged) {
      console.log("[Electron] Tryb produkcyjny - startuje forkowany serwer Next.js...");
      await startProductionServer();
    } else {
      console.log("[Electron] Tryb dev - lacze sie z juz uruchomionym next dev...");
      await new Promise((resolve, reject) => waitForDevServer(resolve, reject));
    }

    createWindow();
  } catch (err) {
    console.error("[Electron] Blad startu aplikacji:", err);
    app.quit();
  }
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (nextServerProcess) {
    console.log("[Electron] Zatrzymuje proces Next.js...");
    nextServerProcess.kill();
    nextServerProcess = null;
  }
  try {
    require("./scraper/scraper-runner").stopScraper();
  } catch (e) {}
});