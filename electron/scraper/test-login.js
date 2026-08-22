// electron/scraper/test-login.js
// Uruchom: node electron/scraper/test-login.js
// (z katalogu glownego projektu CineBridge)

const path = require("path");
const os = require("os");

// Symuluj sciezki jak w Electronie
const DATA_DIR = path.join(os.homedir(), ".cinebridge-test");
const SESSION_PATH = path.join(DATA_DIR, "filmweb-session.json");

// ── Dane logowania ─────────────────────────────────────────────
// Wpisz tutaj swoje dane (tylko do testow, nie commituj tego pliku!)
const EMAIL = "mwas@go2.pl";
const PASSWORD = "clubtechno";

// ──────────────────────────────────────────────────────────────

const { login } = require("./filmweb-auth");
const FilmwebClient = require("./filmweb-client");

function onProgress(data) {
  console.log(`[${data.phase || "?"}] ${data.message || ""}`);
}

async function runTest() {
  console.log("==============================================");
  console.log("  CineBridge - Test logowania i API");
  console.log("==============================================");
  console.log("Data dir:", DATA_DIR);
  console.log("");

  // ── KROK 1: Logowanie ────────────────────────────────────────
  console.log("KROK 1: Logowanie...");
  let cookieString, csrfToken;

  try {
    const result = await login(EMAIL, PASSWORD, onProgress, SESSION_PATH);
    cookieString = result.cookieString;
    csrfToken = result.csrfToken;
    console.log("✓ Logowanie OK");
    console.log("  CSRF token:", csrfToken ? csrfToken.substring(0, 20) + "..." : "brak");
    console.log("  Cookies (fragment):", cookieString.substring(0, 80) + "...");
  } catch (err) {
    console.error("✗ Logowanie NIEUDANE:", err.message);
    process.exit(1);
  }

  console.log("");

  // ── KROK 2: Podstawowe zapytania API ─────────────────────────
  console.log("KROK 2: Test API...");

  const client = new FilmwebClient({
    cookieString,
    csrfToken,
    delay: 300, // krotszy delay na potrzeby testu
    onProgress,
  });

  // Test: dane uzytkownika
  try {
    const userInfo = await client.getUserInfo();
    if (userInfo && userInfo.id) {
      console.log(`✓ getUserInfo OK — zalogowany jako: ${userInfo.name} (ID: ${userInfo.id})`);
    } else {
      console.warn("⚠ getUserInfo zwrocil pusta odpowiedz");
    }
  } catch (err) {
    console.error("✗ getUserInfo NIEUDANE:", err.message);
  }

  // Test: pierwsza strona ocen filmow
  try {
    const votes = await client.getVotePage("film", 1);
    if (Array.isArray(votes) && votes.length > 0) {
      console.log(`✓ getVotePage(film, 1) OK — ${votes.length} ocen na stronie 1`);
      console.log(`  Przyklad: entity=${votes[0].entity}, rate=${votes[0].rate}`);
    } else {
      console.warn("⚠ getVotePage zwrocil pusta liste");
    }
  } catch (err) {
    console.error("✗ getVotePage NIEUDANE:", err.message);
  }

  // Test: info o konkretnym filmie
  const TEST_FILM_ID = 10084281; // Straszny film - znany z poprzednich testow
  try {
    const info = await client.getTitleInfo(TEST_FILM_ID);
    if (info && info.title) {
      console.log(`✓ getTitleInfo(${TEST_FILM_ID}) OK — "${info.title}" (${info.year})`);
    } else {
      console.warn("⚠ getTitleInfo zwrocil pusta odpowiedz");
    }
  } catch (err) {
    console.error("✗ getTitleInfo NIEUDANE:", err.message);
  }

  // Test: preview (rezyserzy)
  try {
    const preview = await client.getTitlePreview(TEST_FILM_ID);
    if (preview && Array.isArray(preview.directors)) {
      const directors = preview.directors.map((d) => d.name).join(", ");
      console.log(`✓ getTitlePreview(${TEST_FILM_ID}) OK — rezyserzy: ${directors}`);
    } else {
      console.warn("⚠ getTitlePreview zwrocil pusta odpowiedz");
    }
  } catch (err) {
    console.error("✗ getTitlePreview NIEUDANE:", err.message);
  }

  // Test: ulubione
  try {
    const favs = await client.getFavorites("film");
    if (Array.isArray(favs)) {
      console.log(`✓ getFavorites(film) OK — ${favs.length} ulubionych filmow`);
    } else {
      console.warn("⚠ getFavorites zwrocil nieprawidlowa odpowiedz");
    }
  } catch (err) {
    console.error("✗ getFavorites NIEUDANE:", err.message);
  }

  // Test: watchlista
  try {
    const wl = await client.getWantToSee("film");
    if (Array.isArray(wl)) {
      console.log(`✓ getWantToSee(film) OK — ${wl.length} filmow na watchliscie`);
    } else {
      console.warn("⚠ getWantToSee zwrocil nieprawidlowa odpowiedz");
    }
  } catch (err) {
    console.error("✗ getWantToSee NIEUDANE:", err.message);
  }

  console.log("");
  console.log("==============================================");
  console.log("Test zakonczony.");
  console.log("Pliki sesji zapisane w:", DATA_DIR);
  console.log("Mozesz je usunac po testach:");
  console.log(`  rm -rf ${DATA_DIR}`);
  console.log("==============================================");
}

runTest().catch((err) => {
  console.error("Nieoczekiwany blad:", err);
  process.exit(1);
});