/**
 * ============================================================
 *  CineBridge – Filmweb Browser Scraper  v2.2
 * ============================================================
 *
 * Jak używać:
 *  1. Zaloguj się na filmweb.pl
 *  2. Otwórz DevTools → Console (F12)
 *  3. Wklej cały ten skrypt i naciśnij Enter
 *  4. Postępuj zgodnie z instrukcjami w konsoli
 *
 * Co skrypt zbiera:
 *  – Oceny filmów i seriali (1-10)
 *  – Daty obejrzenia / oceniania
 *  – Komentarze / recenzje użytkownika
 *  – Listy użytkownika („Chcę zobaczyć", listy własne)
 *  – Ulubione
 *
 * Plik wyjściowy: filmweb_export_YYYY-MM-DD.csv
 *
 * ============================================================
 * SEKCJA KONFIGURACJI – zmień te wartości jeśli Filmweb
 * zmieni strukturę strony.
 * ============================================================
 */

(async function cineBridgeScraper() {
  console.clear();
  console.log("===============================================");
  console.log("  CineBridge - Filmweb Scraper v2.2");
  console.log("===============================================");

  var CHECKPOINT_KEY = "cineBridgeCheckpoint";

  // Wyciagnij token CSRF z ciasteczek Filmweb
  function getCsrfToken() {
    var match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    match = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    var meta = document.querySelector('meta[name="_csrf"]') || document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute("content");
    return null;
  }

  var csrfToken = getCsrfToken();
  console.log("CSRF token: " + (csrfToken ? "znaleziony (" + csrfToken.substring(0, 12) + "...)" : "NIE ZNALEZIONY - moze byc 401"));
  console.log("Zbieranie danych z Filmweb...");
  console.log("");

  var BASE = "https://www.filmweb.pl/api/v1";
  var DELAY = 700; // zwiekszony odstep miedzy requestami
  var allItems = [];
  var errors = 0;
  var counter = 0;
  var processedKeys = new Set();

  // ── Checkpoint: wczytaj poprzedni postep, jesli istnieje ──
  (function loadCheckpoint() {
    try {
      var saved = localStorage.getItem(CHECKPOINT_KEY);
      if (saved) {
        allItems = JSON.parse(saved);
        counter = allItems.length;
        allItems.forEach(function(item) {
          processedKeys.add(item.type + ":" + item.filmweb_id + ":" + item.category);
        });
        console.log("[checkpoint] wczytano " + allItems.length + " pozycji z poprzedniej, przerwanej sesji.");
        console.log("[checkpoint] pozycje juz pobrane zostana pominiete.");
      }
    } catch (e) {
      console.warn("[checkpoint] nie udalo sie wczytac checkpointu", e);
    }
  })();

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return "";
    var s = String(val);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function formatDate(dateNumber) {
    var dateStr = dateNumber ? dateNumber.toString() : "";
    if (!dateStr || dateStr.length < 8) return "";
    return dateStr.substring(0, 4) + "-" + dateStr.substring(4, 6) + "-" + dateStr.substring(6, 8);
  }

  function saveCheckpoint() {
    try {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(allItems));
      console.log("[checkpoint] zapisano " + allItems.length + " pozycji do localStorage.");
    } catch (e) {
      console.warn("[checkpoint] nie udalo sie zapisac checkpointu", e);
    }
  }

  async function fetchApi(endpoint, attempt) {
    attempt = attempt || 1;
    await sleep(DELAY);

    var headers = {
      "Accept": "application/json",
      "X-Locale": "pl"
    };

    if (csrfToken) {
      headers["X-Csrf-Token"] = csrfToken;
      headers["X-CSRF-TOKEN"] = csrfToken;
    }

    var resp;
    try {
      resp = await fetch(BASE + "/" + endpoint, {
        method: "GET",
        credentials: "include",
        headers: headers
      });
    } catch (e) {
      console.warn("Blad sieci -> " + endpoint, e);
      resp = null;
    }

    if (resp && resp.status === 401) {
      if (attempt <= 3) {
        console.warn("  [401] proba " + attempt + "/3 dla " + endpoint + " - odswiezam token i ponawiam...");
        var freshToken = getCsrfToken();
        if (freshToken) csrfToken = freshToken;
        await sleep(1500 * attempt); // backoff: 1.5s, 3s, 4.5s
        return fetchApi(endpoint, attempt + 1);
      } else {
        saveCheckpoint();
        var msg = "Sesja Filmweb wygasla (401) przy zapytaniu:\n" + endpoint +
          "\n\nCo zrobic:\n" +
          "1) Odswiez strone filmweb.pl w TEJ karcie (zaloguj sie ponownie jesli to konieczne)\n" +
          "2) Otworz ponownie konsole i wklej caly skrypt jeszcze raz\n" +
          "3) Skrypt automatycznie pominie " + allItems.length + " juz pobranych pozycji (checkpoint w localStorage)";
        alert(msg);
        throw new Error("SESSION_EXPIRED: " + endpoint);
      }
    }

    if (!resp || !resp.ok) {
      console.warn("HTTP " + (resp ? resp.status : "network-error") + " -> " + endpoint);
      errors++;
      return null;
    }
    return resp.json();
  }

  async function fetchAllVotePages(entityName) {
    var page = 1;
    var allVotes = [];
    while (true) {
      var data = await fetchApi("logged/vote/title/" + entityName + "?page=" + page);
      if (!data || !Array.isArray(data) || data.length === 0) break;
      allVotes.push.apply(allVotes, data);
      console.log("  [ok] " + entityName + " strona " + page + " (" + data.length + " pozycji)");
      page++;
    }
    return allVotes;
  }

  function parseVote(vote) {
    return {
      id:       vote.entity || vote.id || null,
      rate:     vote.rate   || null,
      viewDate: formatDate(vote.viewDate),
      favorite: vote.favorite ? "tak" : "nie",
      comment:  vote.comment || ""
    };
  }

  async function enrichAndPush(vote, type, category, listName) {
    var id = vote.id;
    if (!id) return;

    var key = type + ":" + id + ":" + category;
    if (processedKeys.has(key)) {
      return; // juz pobrane w poprzedniej sesji
    }

    var info = await fetchApi("title/" + id + "/info");
    if (!info) return;

    var ratingData = await fetchApi("film/" + id + "/rating");

    counter++;
    if (counter % 20 === 0) {
      console.log("  ... lacznie " + counter + " pozycji");
      saveCheckpoint(); // okresowy autozapis co 20 pozycji
    }

    allItems.push({
      type:           type,
      title:          csvEscape(info.title         || ""),
      original_title: csvEscape(info.originalTitle || ""),
      year:           info.year                    || "",
      filmweb_id:     id,
      imdb_id:        info.imdbId                  || "",
      category:       category,
      user_rating:    (vote.rate && vote.rate > 0) ? vote.rate : "",
      rated_at:       vote.viewDate                || "",
      watched_at:     vote.viewDate                || "",
      comment:        vote.comment                 || "",
      list_name:      listName                     || "",
      favorite:       vote.favorite                || "nie",
      filmweb_rating: ratingData ? (ratingData.rate  || "") : "",
      vote_count:     ratingData ? (ratingData.count || "") : ""
    });

    processedKeys.add(key);
  }

  async function pushWatchlistItem(id, type) {
    var key = type + ":" + id + ":watchlist";
    if (processedKeys.has(key)) return;

    var info = await fetchApi("title/" + id + "/info");
    if (!info) return;

    counter++;
    if (counter % 20 === 0) {
      console.log("  ... lacznie " + counter + " pozycji");
      saveCheckpoint();
    }

    allItems.push({
      type: type, title: csvEscape(info.title || ""),
      original_title: csvEscape(info.originalTitle || ""),
      year: info.year || "", filmweb_id: id, imdb_id: info.imdbId || "",
      category: "watchlist", user_rating: "", rated_at: "", watched_at: "",
      comment: "", list_name: "Chce zobaczyc", favorite: "nie",
      filmweb_rating: "", vote_count: ""
    });

    processedKeys.add(key);
  }

  try {
    // ── 1. Ocenione filmy ────────────────────────────────────
    console.log("[1/4] Pobieranie ocenionych filmow...");
    var filmVotes = await fetchAllVotePages("film");
    console.log("      Znaleziono " + filmVotes.length + " filmow, pobieram szczegoly...");
    for (var i = 0; i < filmVotes.length; i++) {
      await enrichAndPush(parseVote(filmVotes[i]), "movie", "watched", "");
    }

    console.log("      Pauza przed kolejnym etapem...");
    await sleep(3000);

    // ── 2. Ocenione seriale ──────────────────────────────────
    console.log("[2/4] Pobieranie ocenionych seriali...");
    var serialVotes = await fetchAllVotePages("serial");
    var tvshowVotes = await fetchAllVotePages("tvshow");
    var allSerialVotes = serialVotes.concat(tvshowVotes);
    console.log("      Znaleziono " + allSerialVotes.length + " seriali, pobieram szczegoly...");
    for (var j = 0; j < allSerialVotes.length; j++) {
      await enrichAndPush(parseVote(allSerialVotes[j]), "show", "watched", "");
    }

    await sleep(3000);

    // ── 3. Chce zobaczyc – filmy ─────────────────────────────
    console.log("[3/4] Pobieranie watchlisty (filmy)...");
    var wlFilmRaw = await fetchApi("logged/want2see?entityName=film");
    if (Array.isArray(wlFilmRaw)) {
      var wlFilmIds = wlFilmRaw.filter(function(e) { return Array.isArray(e) ? e[1] > 0 : true; })
                               .map(function(e) { return Array.isArray(e) ? e[0] : e; });
      console.log("      Znaleziono " + wlFilmIds.length + " filmow na watchliscie");
      for (var k = 0; k < wlFilmIds.length; k++) {
        await pushWatchlistItem(wlFilmIds[k], "movie");
      }
    }

    await sleep(3000);

    // ── 4. Chce zobaczyc – seriale ───────────────────────────
    console.log("[4/4] Pobieranie watchlisty (seriale)...");
    var wlSerialRaw = await fetchApi("logged/want2see?entityName=serial");
    var wlTvshowRaw = await fetchApi("logged/want2see?entityName=tvshow");
    var wlSerialAll = [];
    if (Array.isArray(wlSerialRaw)) wlSerialAll = wlSerialAll.concat(wlSerialRaw);
    if (Array.isArray(wlTvshowRaw)) wlSerialAll = wlSerialAll.concat(wlTvshowRaw);
    var wlSerialIds = wlSerialAll.filter(function(e) { return Array.isArray(e) ? e[1] > 0 : true; })
                                 .map(function(e) { return Array.isArray(e) ? e[0] : e; });
    console.log("      Znaleziono " + wlSerialIds.length + " seriali na watchliscie");
    for (var l = 0; l < wlSerialIds.length; l++) {
      await pushWatchlistItem(wlSerialIds[l], "show");
    }

  } catch (err) {
    console.error("[!] Przerwano: " + err.message);
    console.log("[!] Zapisano czesciowe dane (" + allItems.length + " pozycji) do CSV oraz do localStorage.");
    saveCheckpoint();
    // eksportuj to co udalo sie zebrac, zeby nic nie przepadlo
    exportCsv(allItems, true);
    return;
  }

  // ── CSV (pelny eksport) ────────────────────────────────────
  exportCsv(allItems, false);

  function exportCsv(items, partial) {
    if (items.length === 0) {
      console.error("[!] Brak danych. Upewnij sie ze jestes zalogowany na filmweb.pl");
      return;
    }

    var COLS = ["type","title","original_title","year","filmweb_id","imdb_id",
                "category","user_rating","rated_at","watched_at","comment",
                "list_name","favorite","filmweb_rating","vote_count"];

    var csvContent = COLS.join(",") + "\n" +
      items.map(function(item) {
        return COLS.map(function(c) { return csvEscape(item[c]); }).join(",");
      }).join("\n");

    var today = new Date().toISOString().slice(0, 10);
    var filename = (partial ? "filmweb_export_CZESCIOWY_" : "filmweb_export_") + today + ".csv";
    var blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    console.log("");
    console.log("===============================================");
    if (partial) {
      console.warn("Eksport CZESCIOWY! Pobrano " + items.length + " pozycji.");
      console.warn("Wznow skrypt po ponownym zalogowaniu - pominie juz pobrane pozycje.");
    } else {
      console.log("Gotowe! Pobrano " + items.length + " pozycji.");
      localStorage.removeItem(CHECKPOINT_KEY);
      console.log("[checkpoint] wyczyszczono - eksport zakonczony pomyslnie.");
    }
    if (errors > 0) console.warn("(" + errors + " bledow)");
    console.log("Plik: " + filename);
    console.log("===============================================");
  }

})();