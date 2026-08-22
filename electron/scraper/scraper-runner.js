// electron/scraper/scraper-runner.js
const path = require("path");
const fs = require("fs");
const { buildCsv } = require("./csv-builder");

// Aktywny abort controller (globalny w scope modulu)
let _abortController = null;
let _isRunning = false;
let _lastProgress = null;

function getPaths(dataDir) {
  const today = new Date().toISOString().slice(0, 10); // 2026-08-16
  return {
    db: path.join(dataDir, "filmweb-db.json"),
    csv: path.join(dataDir, `filmweb_export_${today}.csv`), // <- ZMIANA
    archive: path.join(dataDir, "archive"),
  };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadDb(dataDir) {
  const { db: dbPath } = getPaths(dataDir);
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    }
  } catch (e) {
    console.error("[runner] Blad wczytywania bazy:", e.message);
  }
  return { itemsMap: {}, listMeta: {}, lastSync: null };
}

function saveDb(db, dataDir) {
  const { db: dbPath } = getPaths(dataDir);
  ensureDir(path.dirname(dbPath));
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function saveCsv(csvContent, dataDir) {
  const { csv: csvPath, archive: archiveDir } = getPaths(dataDir);
  ensureDir(path.dirname(csvPath));
  fs.writeFileSync(csvPath, csvContent, "utf-8");

  ensureDir(archiveDir);
  const filename = path.basename(csvPath); // zawiera datę
  const archivePath = path.join(archiveDir, filename);
  fs.writeFileSync(archivePath, csvContent, "utf-8");

  return csvPath;
}

function clearData(dataDir) {
  try {
    const { db: dbPath } = getPaths(dataDir);
    
    let cleared = [];
    
    // Usuń bazę JSON
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      cleared.push("filmweb-db.json");
    }
    
    // Usuń wszystkie pliki CSV w głównym katalogu (wszystkie daty)
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      for (const file of files) {
        if (file.startsWith("filmweb_export") && file.endsWith(".csv")) {
          fs.unlinkSync(path.join(dataDir, file));
          cleared.push(file);
        }
      }
    }
    
    return { success: true, cleared };
  } catch (err) {
    console.error("[runner] Błąd czyszczenia danych:", err.message);
    return { success: false, error: err.message };
  }
}

async function runScraper({ email, password, mainWindow, dataDir }) {
  _abortController = new AbortController();
  _isRunning = true;
  _lastProgress = null;

  const sendProgress = (data) => {
    _lastProgress = data;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("scraper:progress", data);
    }
  };

  // WAZNE: `db` deklarujemy w scope calej funkcji, zeby catch mial dostep
  // do TEGO SAMEGO obiektu ktory byl mutowany w trakcie scrapowania,
  // a nie wczytywal starej wersji z dysku (co kasowaloby postep przy Stop/bledzie)
  let db = null;

  try {
    // 1. Logowanie (pierwsze)
    sendProgress({
      phase: "auth",
      message: "Logowanie do Filmweb...",
      percent: 0,
    });

    const { login } = require("./filmweb-auth");
    let authData = await login(email, password, sendProgress);

    // Callback do ponownego zalogowania w trakcie scrapowania (gdy sesja wygaśnie)
    const reauth = async () => {
      sendProgress({
        phase: "auth",
        message: "Sesja wygasła — ponowne logowanie...",
      });
      authData = await login(email, password, sendProgress);
      return authData;
    };

    // 2. Wczytaj baze
    sendProgress({
      phase: "init",
      message: "Wczytywanie bazy danych...",
      percent: 2,
    });

    db = loadDb(dataDir);
    const itemCount = Object.keys(db.itemsMap).length;

    sendProgress({
      phase: "init",
      message:
        itemCount > 0
          ? `Wczytano ${itemCount} pozycji z poprzedniej synchronizacji.`
          : "Pierwsze uruchomienie - pelne skanowanie.",
    });

    // 3. Scraping
    const FilmwebClient = require("./filmweb-client");
    const FilmwebScraper = require("./filmweb-scraper");

    const client = new FilmwebClient({
      cookieString: authData.cookieString,
      csrfToken: authData.csrfToken,
      delay: 800,
      onProgress: sendProgress,
      onReauth: reauth, // <- przekazujemy callback do auto re-login
    });

    // Checkpoint - okresowy zapis bazy w trakcie dlugich petli,
    // zeby nie stracic postepu przy awarii/wymuszonym zamknieciu aplikacji
    const checkpoint = () => {
      try {
        saveDb(db, dataDir);
      } catch (e) {
        console.error("[runner] Blad checkpointu:", e.message);
      }
    };

    const scraper = new FilmwebScraper({
      client,
      db,
      onProgress: sendProgress,
      signal: _abortController.signal,
      onCheckpoint: checkpoint,
      checkpointEvery: 50, // zapisuj co 50 przetworzonych pozycji
    });

    const stats = await scraper.sync();

    // 4. Zapisz baze i CSV
    saveDb(db, dataDir);
    const csvContent = buildCsv(db.itemsMap);
    const csvPath = saveCsv(csvContent, dataDir);
    const totalItems = Object.keys(db.itemsMap).length;

    const result = {
      success: true,
      csvPath,
      csvContent,
      totalItems,
      stats,
      lastSync: new Date(db.lastSync).toLocaleString("pl-PL"),
      errors: client.errors,
      concurrencyDropped: stats.concurrencyDropped || false, // <- DODANE
    };

    sendProgress({
      phase: "done",
      message: stats.concurrencyDropped
        ? `Gotowe! Zsynchronizowano ${totalItems} pozycji. (Równoległość zmniejszona do 1 z powodu rate limitów)`
        : `Gotowe! Zsynchronizowano ${totalItems} pozycji.`,
      percent: 100,
      ...result,
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("scraper:done", result);
    }

    return result;
  } catch (err) {
    const isAborted = err.message === "ABORTED";
    const isSessionExpired = err.message?.startsWith("SESSION_EXPIRED");

    const errorResult = {
      success: false,
      error: err.message,
      isAborted,
      isSessionExpired,
    };

    if (!isAborted) {
      sendProgress({ phase: "error", message: `Blad: ${err.message}` });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("scraper:error", errorResult);
      }
    } else {
      sendProgress({ phase: "stopped", message: "Scrapowanie zatrzymane. Postep zostal zapisany." });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("scraper:error", errorResult);
      }
    }

    // Zapisz co zdazylismy zebrac - uzywamy TEGO SAMEGO obiektu `db`
    // ktory byl mutowany w trakcie dzialania scrapera (jesli zdazyl powstac)
    if (db) {
      try {
        saveDb(db, dataDir);
        console.log(`[runner] Zapisano czesciowy postep: ${Object.keys(db.itemsMap).length} pozycji.`);
      } catch (e) {
        console.error("[runner] Blad zapisu czesciowego postepu:", e.message);
      }
    }

    throw err;
  } finally {
    _abortController = null;
    _isRunning = false;
  }
}

function stopScraper() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
    return true;
  }
  return false;
}

function isRunning() {
  return _isRunning;
}

function getLastProgress() {
  return _lastProgress;
}

function getLastSync(dataDir) {
  const db = loadDb(dataDir);
  return {
    lastSync: db.lastSync
      ? new Date(db.lastSync).toLocaleString("pl-PL")
      : null,
    totalItems: Object.keys(db.itemsMap).length,
    running: _isRunning,
    lastProgress: _lastProgress,
  };
}

function getCsvPath(dataDir) {
  const { csv } = getPaths(dataDir);
  return fs.existsSync(csv) ? csv : null;
}

module.exports = {
  runScraper,
  stopScraper,
  getLastSync,
  getCsvPath,
  isRunning,
  getLastProgress,
  clearData,
};