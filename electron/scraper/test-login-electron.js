// electron/scraper/test-login-electron.js
// Uruchom: npx electron electron/scraper/test-login-electron.js

const { app } = require("electron");
const { login } = require("./filmweb-auth");
const FilmwebClient = require("./filmweb-client");

const EMAIL = "mwas@go2.pl";
const PASSWORD = "clubtechno";

function onProgress(data) {
  console.log(`[${data.phase || "?"}] ${data.message || ""}`);
}

// WAZNE: zapobiegaj automatycznemu zamknieciu aplikacji
// gdy zamykamy okno logowania (ktore jest jedynym oknem w tym tescie)
app.on("window-all-closed", () => {
  // celowo nic nie rob - zapobiega domyslnemu app.quit()
});

app.whenReady().then(async () => {
  console.log("==============================================");
  console.log("  CineBridge - Test logowania (Electron)");
  console.log("==============================================\n");

  try {
    console.log("KROK 1: Logowanie...");
    const { cookieString, csrfToken } = await login(EMAIL, PASSWORD, onProgress);
    console.log("✓ Logowanie OK\n");

    console.log("KROK 2: Test API...");
    const client = new FilmwebClient({ cookieString, csrfToken, delay: 300, onProgress });

    const userInfo = await client.getUserInfo();
    console.log(`✓ Zalogowany jako: ${userInfo?.name} (ID: ${userInfo?.id})`);

    const votes = await client.getVotePage("film", 1);
    console.log(`✓ Oceny filmow: ${votes.length} na stronie 1`);
    if (votes.length > 0) {
      console.log(`  Przyklad: entity=${votes[0].entity}, rate=${votes[0].rate}`);
    }

    const TEST_FILM_ID = votes[0]?.entity || 10084281;

    const info = await client.getTitleInfo(TEST_FILM_ID);
    console.log(`✓ getTitleInfo(${TEST_FILM_ID}) — "${info?.title}" (${info?.year})`);

    const preview = await client.getTitlePreview(TEST_FILM_ID);
    const directors = preview?.directors?.map((d) => d.name).join(", ") || "brak";
    console.log(`✓ getTitlePreview(${TEST_FILM_ID}) — rezyserzy: ${directors}`);

    const favs = await client.getFavorites("film");
    console.log(`✓ getFavorites(film) — ${favs.length} ulubionych`);

    const wl = await client.getWantToSee("film");
    console.log(`✓ getWantToSee(film) — ${wl.length} na watchliscie`);

    console.log("\n✓✓✓ WSZYSTKIE TESTY PRZESZLY POMYSLNIE ✓✓✓");
  } catch (err) {
    console.error("\n✗ BLAD:", err.message);
    console.error(err.stack);
  }

  console.log("\nTest zakonczony. Zamykam aplikacje...");
  app.quit();
});