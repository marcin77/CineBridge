/**
 * ============================================================
 *  CineBridge – Filmweb Browser Scraper  v2.0
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
  console.log("  CineBridge - Filmweb Scraper v2.0");
  console.log("===============================================");
  console.log("Zbieranie danych z Filmweb...");
  console.log("");

  const BASE = "https://www.filmweb.pl/api/v1";
  const DELAY = 400;
  const allItems = [];
  let errors = 0;
  let counter = 0;

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

  async function fetchApi(endpoint) {
    await sleep(DELAY);
    var resp = await fetch(BASE + "/" + endpoint, {
      method: "GET",
      credentials: "include",
      headers: {
        Cookie: document.cookie,
        "X-Locale": "pl",
        "Accept": "application/json"
      }
    });
    if (!resp.ok) {
      console.warn("HTTP " + resp.status + " -> " + endpoint);
      errors++;
      return null;
    }
    return resp.json();
  }

  // Pobierz wszystkie strony dla vote/title/film lub vote/title/serial
  async function fetchAllVotePages(entityName) {
    var page = 1;
    var allVotes = [];
    while (true) {
      var data = await fetchApi("logged/vote/title/" + entityName + "?page=" + page);
      if (!data || !Array.isArray(data) || data.length === 0) break;
      allVotes.push.apply(allVotes, data);
      console.log("  [ok] votes/" + entityName + " strona " + page + " (" + data.length + " pozycji)");
      page++;
    }
    return allVotes;
  }

  // Zamien surowy wpis vote na obiekt
  // Filmweb zwraca: { entity, rate, viewDate, favorite, timestamp, ... }
  function parseVote(vote) {
    return {
      id:        vote.entity  || vote.id   || null,
      rate:      vote.rate    || null,
      viewDate:  formatDate(vote.viewDate),
      favorite:  vote.favorite ? "tak" : "nie",
      comment:   vote.comment || ""
    };
  }

  // Pobierz szczegoly tytulu i polacz z danymi vote
  async function enrichAndPush(vote, type, category, listName) {
    var id = vote.id;
    if (!id) return;

    var info = await fetchApi("title/" + id + "/info");
    if (!info) return;

    var ratingData = await fetchApi("film/" + id + "/rating");

    counter++;
    if (counter % 10 === 0) {
      console.log("  ... pobrano lacznie " + counter + " pozycji");
    }

    allItems.push({
      type:           type,
      title:          csvEscape(info.title          || ""),
      original_title: csvEscape(info.originalTitle  || ""),
      year:           info.year                     || "",
      filmweb_id:     id,
      imdb_id:        info.imdbId                   || "",
      category:       category,
      user_rating:    (vote.rate && vote.rate > 0) ? vote.rate : "",
      rated_at:       vote.viewDate                 || "",
      watched_at:     vote.viewDate                 || "",
      comment:        vote.comment                  || "",
      list_name:      listName                      || "",
      favorite:       vote.favorite                 || "nie",
      filmweb_rating: ratingData ? (ratingData.rate || "") : "",
      vote_count:     ratingData ? (ratingData.count || "") : ""
    });
  }

  // ── 1. Ocenione filmy ────────────────────────────────────
  console.log("[1/4] Pobieranie ocenionych filmow...");
  var filmVotes = await fetchAllVotePages("film");
  console.log("      Znaleziono " + filmVotes.length + " filmow, pobieranie szczegolów...");
  for (var i = 0; i < filmVotes.length; i++) {
    await enrichAndPush(parseVote(filmVotes[i]), "movie", "watched", "");
  }

  // ── 2. Ocenione seriale (serial + tvshow) ───────────────
  console.log("[2/4] Pobieranie ocenionych seriali...");
  var serialVotes  = await fetchAllVotePages("serial");
  var tvshowVotes  = await fetchAllVotePages("tvshow");
  var allSerialVotes = serialVotes.concat(tvshowVotes);
  console.log("      Znaleziono " + allSerialVotes.length + " seriali, pobieranie szczegolów...");
  for (var j = 0; j < allSerialVotes.length; j++) {
    await enrichAndPush(parseVote(allSerialVotes[j]), "show", "watched", "");
  }

  // ── 3. Chce zobaczyc – filmy ─────────────────────────────
  console.log("[3/4] Pobieranie listy 'Chce zobaczyc' (filmy)...");
  var wlFilmRaw = await fetchApi("logged/want2see?entityName=film");
  if (Array.isArray(wlFilmRaw)) {
    // format: [ [id, timestamp], ... ]  – filtruj timestamp > 0
    var wlFilmIds = wlFilmRaw.filter(function(e) { return e[1] > 0; }).map(function(e) { return e[0]; });
    console.log("      Znaleziono " + wlFilmIds.length + " filmow na liscie");
    for (var k = 0; k < wlFilmIds.length; k++) {
      var wlId = wlFilmIds[k];
      var info = await fetchApi("title/" + wlId + "/info");
      if (!info) continue;
      counter++;
      allItems.push({
        type:           "movie",
        title:          csvEscape(info.title         || ""),
        original_title: csvEscape(info.originalTitle || ""),
        year:           info.year                    || "",
        filmweb_id:     wlId,
        imdb_id:        info.imdbId                  || "",
        category:       "watchlist",
        user_rating:    "",
        rated_at:       "",
        watched_at:     "",
        comment:        "",
        list_name:      "Chce zobaczyc",
        favorite:       "nie",
        filmweb_rating: "",
        vote_count:     ""
      });
    }
  }

  // ── 4. Chce zobaczyc – seriale ───────────────────────────
  console.log("[4/4] Pobieranie listy 'Chce zobaczyc' (seriale)...");
  var wlSerialRaw = await fetchApi("logged/want2see?entityName=serial");
  var wlTvshowRaw = await fetchApi("logged/want2see?entityName=tvshow");
  var wlAllSerial = [];
  if (Array.isArray(wlSerialRaw)) wlAllSerial = wlAllSerial.concat(wlSerialRaw);
  if (Array.isArray(wlTvshowRaw)) wlAllSerial = wlAllSerial.concat(wlTvshowRaw);
  var wlSerialIds = wlAllSerial.filter(function(e) { return e[1] > 0; }).map(function(e) { return e[0]; });
  console.log("      Znaleziono " + wlSerialIds.length + " seriali na liscie");
  for (var l = 0; l < wlSerialIds.length; l++) {
    var wsId = wlSerialIds[l];
    var wsInfo = await fetchApi("title/" + wsId + "/info");
    if (!wsInfo) continue;
    counter++;
    allItems.push({
      type:           "show",
      title:          csvEscape(wsInfo.title         || ""),
      original_title: csvEscape(wsInfo.originalTitle || ""),
      year:           wsInfo.year                    || "",
      filmweb_id:     wsId,
      imdb_id:        wsInfo.imdbId                  || "",
      category:       "watchlist",
      user_rating:    "",
      rated_at:       "",
      watched_at:     "",
      comment:        "",
      list_name:      "Chce zobaczyc",
      favorite:       "nie",
      filmweb_rating: "",
      vote_count:     ""
    });
  }

  // ── Build CSV ────────────────────────────────────────────
  if (allItems.length === 0) {
    console.error("[!] Nie udalo sie pobrac zadnych danych.");
    console.error("    1. Upewnij sie ze jestes zalogowany na filmweb.pl");
    console.error("    2. Skrypt musi byc uruchomiony na stronie filmweb.pl");
    console.error("    3. Twoje konto moze byc puste lub prywatne");
    return;
  }

  var CSV_COLS = [
    "type", "title", "original_title", "year",
    "filmweb_id", "imdb_id", "category",
    "user_rating", "rated_at", "watched_at",
    "comment", "list_name", "favorite",
    "filmweb_rating", "vote_count"
  ];

  var header = CSV_COLS.join(",");
  var rows = allItems.map(function(item) {
    return CSV_COLS.map(function(col) { return csvEscape(item[col]); }).join(",");
  });
  var csvContent = [header].concat(rows).join("\n");

  var today = new Date().toISOString().slice(0, 10);
  var filename = "filmweb_export_" + today + ".csv";

  var blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  console.log("");
  console.log("===============================================");
  console.log("Gotowe! Pobrano " + allItems.length + " pozycji.");
  if (errors > 0) {
    console.warn("(" + errors + " bledow - czesc danych moze byc niekompletna)");
  }
  console.log("Plik: " + filename);
  console.log("===============================================");

})();
