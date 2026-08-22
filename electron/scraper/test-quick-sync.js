// electron/scraper/test-quick-sync.js
// Szybki test na malej probce (10 pozycji na kategorie)
// Uruchom: npx electron electron/scraper/test-quick-sync.js

const { app } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");

const EMAIL = "TWOJ_EMAIL@example.com";
const PASSWORD = "TWOJE_HASLO";
const TEST_LIMIT = 10;

const TEST_DATA_DIR = path.join(os.homedir(), ".cinebridge-test-quick");

app.on("window-all-closed", () => {});

function onProgress(data) {
  const p = data.percent !== undefined ? ` [${data.percent}%]` : "";
  const eta = data.eta ? ` ETA: ${data.eta}` : "";
  console.log(`  ${data.message || ""}${p}${eta}`);
}

app.whenReady().then(async () => {
  console.log("==============================================");
  console.log(`  Test SZYBKI (limit: ${TEST_LIMIT} pozycji/kategoria)`);
  console.log("==============================================");
  console.log("Data dir:", TEST_DATA_DIR);
  console.log("");

  const startTime = Date.now();

  try {
    const { login } = require("./filmweb-auth");
    const FilmwebClient = require("./filmweb-client");
    const FilmwebScraper = require("./filmweb-scraper");
    const { buildCsv } = require("./csv-builder");

    // 1. Logowanie
    console.log("KROK 1: Logowanie...");
    const { cookieString, csrfToken } = await login(EMAIL, PASSWORD, onProgress);
    console.log("✓ Zalogowano\n");

    // 2. Wczytaj/stworz baze testowa
    const dbPath = path.join(TEST_DATA_DIR, "filmweb-db.json");
    let db = { itemsMap: {}, listMeta: {}, lastSync: null };
    if (fs.existsSync(dbPath)) {
      db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
      console.log(`Wczytano istniejaca baze testowa: ${Object.keys(db.itemsMap).length} pozycji\n`);
    }

    // 3. Scraper z limitem
    console.log("KROK 2: Synchronizacja (z limitem)...\n");
    const client = new FilmwebClient({ cookieString, csrfToken, delay: 400, onProgress });
    const scraper = new FilmwebScraper({
      client,
      db,
      onProgress,
      testLimit: TEST_LIMIT,
    });

    const stats = await scraper.sync();

    // 4. Zapisz wyniki testowe
    if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    const csvContent = buildCsv(db.itemsMap);
    const csvPath = path.join(TEST_DATA_DIR, "test_export.csv");
    fs.writeFileSync(csvPath, csvContent, "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalItems = Object.keys(db.itemsMap).length;

    console.log("\n==============================================");
    console.log("WYNIK:");
    console.log("==============================================");
    console.log("Lacznie pozycji w bazie:", totalItems);
    console.log("Bledy API:", client.errors);
    console.log("");
    console.log("Statystyki tej synchronizacji:");
    console.log("  Filmy:    +" + stats.moviesAdded + " / -" + stats.moviesRemoved + " / ~" + stats.moviesUpdated);
    console.log("  Seriale:  +" + stats.showsAdded + " / -" + stats.showsRemoved + " / ~" + stats.showsUpdated);
    console.log("  Watchlist:+" + stats.watchlistAdded + " / -" + stats.watchlistRemoved);
    console.log("  Listy:    +" + stats.listsAdded + " / -" + stats.listsRemoved + " (zmienione: " + stats.listsUpdated + ")");
    console.log("");
    console.log("Czas: " + elapsed + "s");
    console.log("CSV zapisany: " + csvPath);

    // Pokaz zawartosc CSV
    const lines = csvContent.split("\n").filter((l) => l.trim());
    console.log("\nCSV (" + lines.length + " linii, w tym naglowek):");
    console.log(lines[0]); // naglowek
    lines.slice(1, 6).forEach((l) => console.log(l.substring(0, 200)));
    if (lines.length > 6) console.log(`... i ${lines.length - 6} wiecej linii`);

    console.log("\n✓✓✓ TEST ZAKONCZONY SUKCESEM ✓✓✓");
  } catch (err) {
    console.error("\n✗✗✗ TEST NIEUDANY ✗✗✗");
    console.error("Blad:", err.message);
    console.error(err.stack);
  }

  console.log("\nDane testowe: " + TEST_DATA_DIR);
  console.log("Usun po tescie: rm -rf " + TEST_DATA_DIR);

  app.quit();
});