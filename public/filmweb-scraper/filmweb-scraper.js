/**
 * ============================================================
 *
 *  CineBridge – Filmweb Browser Scraper  v4.0
 *
 * ============================================================
 * 
 * Jak używać:
 *  1. Zaloguj się na filmweb.pl
 *  2. Otwórz DevTools → Console (F12)
 *  3. Wklej cały ten skrypt i naciśnij Enter
 *  4. Postępuj zgodnie z instrukcjami w konsoli
 *  5. Po pierwszym pełnym pobraniu, kazde kolejne 
 *     bedzie pobierac tylko zmienione, usuniete lub dodane pozycje.
 *
 * UWAGA: Jeśli dostaniesz alert o wygasłej sesji:
 * - Odśwież kartę z filmweb.pl (zaloguj się ponownie, jeśli trzeba).
 * - Otwórz konsolę i wklej ten sam skrypt jeszcze raz.
 * - Automatycznie pominie już zebrane pozycje i doczyta resztę.
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
  console.log("  CineBridge - Filmweb Scraper v4.0 (sync przyrostowy)");
  console.log("===============================================");

  var DB_KEY = "cineBridgeDatabase";
  var scriptStartTime = Date.now();

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
  console.log("CSRF token: " + (csrfToken ? "znaleziony" : "NIE ZNALEZIONY - moze byc 401"));

  var BASE = "https://www.filmweb.pl/api/v1";
  var DELAY = 600;
  var errors = 0;
  var userId = null;

  // ── Baza danych (trwala, miedzy uruchomieniami) ──────────────
  var db = { itemsMap: {}, listMeta: {}, lastSync: null };

  (function loadDb() {
    try {
      var saved = localStorage.getItem(DB_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        db.itemsMap = parsed.itemsMap || {};
        db.listMeta = parsed.listMeta || {};
        db.lastSync = parsed.lastSync || null;
        var count = Object.keys(db.itemsMap).length;
        console.log("[baza] wczytano " + count + " pozycji z poprzedniej synchronizacji.");
        if (db.lastSync) {
          console.log("[baza] ostatnia synchronizacja: " + new Date(db.lastSync).toLocaleString());
        }
      } else {
        console.log("[baza] brak wczesniejszych danych - to bedzie pelne, pierwsze skanowanie.");
      }
    } catch (e) {
      console.warn("[baza] nie udalo sie wczytac bazy", e);
    }
  })();

  function saveDb() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn("[baza] nie udalo sie zapisac bazy", e);
    }
  }

  function getItemKey(type, id, category, listId) {
    if (category === "list") return type + ":" + id + ":list:" + listId;
    return type + ":" + id + ":" + category;
  }

  function formatDuration(ms) {
    if (ms < 0 || !isFinite(ms)) ms = 0;
    var totalSec = Math.round(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var parts = [];
    if (h > 0) parts.push(h + "h");
    if (m > 0 || h > 0) parts.push(m + "m");
    parts.push(s + "s");
    return parts.join(" ");
  }

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

  // ── fetchApi z retry/401 ──────────────────────────────────────
  async function fetchApi(endpoint, attempt) {
    attempt = attempt || 1;
    await sleep(DELAY);

    var headers = { "Accept": "application/json", "X-Locale": "pl" };
    if (csrfToken) {
      headers["X-Csrf-Token"] = csrfToken;
      headers["X-CSRF-TOKEN"] = csrfToken;
    }

    var resp;
    try {
      resp = await fetch(BASE + "/" + endpoint, { method: "GET", credentials: "include", headers: headers });
    } catch (e) {
      console.warn("Blad sieci -> " + endpoint, e);
      resp = null;
    }

    if (resp && resp.status === 401) {
      if (attempt <= 3) {
        console.warn("  [401] proba " + attempt + "/3 dla " + endpoint);
        var freshToken = getCsrfToken();
        if (freshToken) csrfToken = freshToken;
        await sleep(1500 * attempt);
        return fetchApi(endpoint, attempt + 1);
      } else {
        saveDb();
        alert("Sesja Filmweb wygasla przy: " + endpoint +
          "\n\nOdswiez strone i wklej skrypt ponownie.\n" +
          "Postep jest zapisany - skrypt sam wykryje co juz zrobiono.");
        throw new Error("SESSION_EXPIRED: " + endpoint);
      }
    }

    if (resp && resp.status === 429) {
      console.warn("[429] rate limit, czekam 15s...");
      await sleep(15000);
      return fetchApi(endpoint, attempt);
    }

    if (!resp || !resp.ok) {
      console.warn("HTTP " + (resp ? resp.status : "network-error") + " -> " + endpoint);
      errors++;
      return null;
    }
    return resp.json();
  }

  async function fetchUserId() {
    var info = await fetchApi("logged/info");
    if (info && info.id) {
      console.log("Zalogowany jako: " + info.name + " (ID: " + info.id + ")");
      return info.id;
    }
    console.warn("[!] Nie udalo sie pobrac ID uzytkownika");
    return null;
  }

  async function fetchFavorites() {
    var movieIds = new Set();
    var showIds = new Set();

    var filmData = await fetchApi("logged/favorites?entityName=film");
    if (Array.isArray(filmData)) filmData.forEach(function(v) { if (v.entity) movieIds.add(v.entity); });

    var serialData = await fetchApi("logged/favorites?entityName=serial");
    if (Array.isArray(serialData)) serialData.forEach(function(v) { if (v.entity) showIds.add(v.entity); });

    var tvshowData = await fetchApi("logged/favorites?entityName=tvshow");
    if (Array.isArray(tvshowData)) tvshowData.forEach(function(v) { if (v.entity) showIds.add(v.entity); });

    console.log("Ulubione: filmy " + movieIds.size + ", seriale " + showIds.size);
    return { movieIds: movieIds, showIds: showIds };
  }

  async function fetchAllVotePages(entityName) {
    var page = 1;
    var allVotes = [];
    while (true) {
      var data = await fetchApi("logged/vote/title/" + entityName + "?page=" + page);
      if (!data || !Array.isArray(data) || data.length === 0) break;
      data.forEach(function(v) { v._entityName = entityName; });
      allVotes.push.apply(allVotes, data);
      page++;
    }
    return allVotes;
  }

  function parseVote(vote) {
    return {
      id: vote.entity || vote.id || null,
      rate: vote.rate || null,
      viewDate: formatDate(vote.viewDate),
      entityName: vote._entityName || null
    };
  }

  async function fetchComment(id, entityName) {
    if (!userId || !entityName) return "";
    var data = await fetchApi("users/" + userId + "/votes/" + entityName + "/" + id);
    if (data && data.comment) return data.comment;
    return "";
  }

  async function fetchDirectors(id) {
    var data = await fetchApi("film/" + id + "/preview");
    if (data && Array.isArray(data.directors) && data.directors.length > 0) {
      return data.directors.map(function(d) { return d.name; }).join("; ");
    }
    return "";
  }

  async function fetchListIds(published) {
    var page = 1;
    var ids = [];
    while (true) {
      var data = await fetchApi("user/" + userId + "/lists?page=" + page + "&published=" + published);
      if (!data || !Array.isArray(data.elements) || data.elements.length === 0) break;
      data.elements.forEach(function(e) { ids.push(e.listId); });
      if (page >= (data.totalPages || 1)) break;
      page++;
    }
    return ids;
  }

  async function fetchListDetails(listId) {
    return await fetchApi("lists/" + listId);
  }

  // ── Uniwersalne wzbogacanie pojedynczej pozycji ──────────────
  async function buildEnrichedItem(id, type, category, opts) {
    opts = opts || {};
    var info = await fetchApi("title/" + id + "/info");
    if (!info) return null;

    var ratingData = null;
    var comment = "";
    if (category === "watched") {
      ratingData = await fetchApi("film/" + id + "/rating");
      comment = await fetchComment(id, opts.entityName);
    }

    var director = await fetchDirectors(id);

    var isFavorite = false;
    if (category === "watched" && opts.favoriteSet) {
      isFavorite = opts.favoriteSet.has(id);
    }

    return {
      type: type,
      title: csvEscape(info.title || ""),
      original_title: csvEscape(info.originalTitle || ""),
      year: info.year || "",
      director: csvEscape(director),
      filmweb_id: id,
      imdb_id: info.imdbId || "",
      category: category,
      user_rating: (opts.rate && opts.rate > 0) ? opts.rate : "",
      rated_at: opts.viewDate || "",
      watched_at: opts.viewDate || "",
      comment: comment,
      list_name: opts.listName || "",
      list_id: opts.listId || "",
      list_status: opts.listStatus || "",
      favorite: isFavorite ? "tak" : "nie",
      filmweb_rating: ratingData ? (ratingData.rate || "") : "",
      vote_count: ratingData ? (ratingData.count || "") : ""
    };
  }

  // ── Aktualizacja flagi ulubione dla juz istniejacych pozycji ──
  function syncFavoritesFlags(favoriteMovieIds, favoriteShowIds) {
    var updated = 0;
    Object.keys(db.itemsMap).forEach(function(key) {
      var item = db.itemsMap[key];
      if (item.category !== "watched") return;
      var isFav = item.type === "movie" ? favoriteMovieIds.has(item.filmweb_id) : favoriteShowIds.has(item.filmweb_id);
      var newVal = isFav ? "tak" : "nie";
      if (item.favorite !== newVal) {
        item.favorite = newVal;
        updated++;
      }
    });
    if (updated > 0) console.log("  [ulubione] zaktualizowano status dla " + updated + " pozycji.");
  }

  // ── Sync ocenionych (filmy/seriale) ──────────────────────────
  async function syncVotesPhase(entityNames, type, phaseLabel, favoriteSet) {
    console.log("[" + phaseLabel + "] sprawdzanie zmian...");

    var rawVotes = [];
    for (var e = 0; e < entityNames.length; e++) {
      var votes = await fetchAllVotePages(entityNames[e]);
      rawVotes = rawVotes.concat(votes);
    }

    var currentMap = {};
    rawVotes.forEach(function(v) {
      var pv = parseVote(v);
      if (pv.id) currentMap[pv.id] = pv;
    });

    var currentIds = Object.keys(currentMap).map(Number);
    var currentIdSet = new Set(currentIds);

    var existingIds = [];
    Object.keys(db.itemsMap).forEach(function(key) {
      var item = db.itemsMap[key];
      if (item.type === type && item.category === "watched") existingIds.push(item.filmweb_id);
    });
    var existingIdSet = new Set(existingIds);

    var toAdd = currentIds.filter(function(id) { return !existingIdSet.has(id); });
    var toRemove = existingIds.filter(function(id) { return !currentIdSet.has(id); });
    var toCheck = currentIds.filter(function(id) { return existingIdSet.has(id); });

    var toUpdate = [];
    toCheck.forEach(function(id) {
      var key = getItemKey(type, id, "watched");
      var item = db.itemsMap[key];
      var pv = currentMap[id];
      var newRating = (pv.rate && pv.rate > 0) ? pv.rate : "";
      if (String(item.user_rating) !== String(newRating) || item.rated_at !== pv.viewDate) {
        toUpdate.push(id);
      }
    });

    console.log("  Nowe: " + toAdd.length + " | usuniete: " + toRemove.length + " | zmienione: " + toUpdate.length +
      " | bez zmian: " + (currentIds.length - toAdd.length - toUpdate.length) + " (z " + currentIds.length + " ocenionych)");

    toRemove.forEach(function(id) { delete db.itemsMap[getItemKey(type, id, "watched")]; });

    var toProcess = toAdd.concat(toUpdate);
    var total = toProcess.length;
    if (total > 0) {
      var phaseStart = Date.now();
      for (var i = 0; i < total; i++) {
        var id = toProcess[i];
        var pv = currentMap[id];
        var item = await buildEnrichedItem(id, type, "watched", {
          entityName: pv.entityName, rate: pv.rate, viewDate: pv.viewDate, favoriteSet: favoriteSet
        });
        if (item) db.itemsMap[getItemKey(type, id, "watched")] = item;

        if ((i + 1) % 15 === 0 || i === total - 1) {
          var elapsed = Date.now() - phaseStart;
          var avg = elapsed / (i + 1);
          var eta = (total - i - 1) * avg;
          console.log("  ... " + (i + 1) + "/" + total + " | pozostalo: ~" + formatDuration(eta));
          saveDb();
        }
      }
    }

    saveDb();
    return { added: toAdd.length, removed: toRemove.length, updated: toUpdate.length };
  }

  // ── Sync watchlisty ───────────────────────────────────────────
  async function syncWatchlistPhase(entityNames, type, phaseLabel) {
    console.log("[" + phaseLabel + "] sprawdzanie zmian...");

    var currentIds = [];
    for (var e = 0; e < entityNames.length; e++) {
      var raw = await fetchApi("logged/want2see?entityName=" + entityNames[e]);
      if (Array.isArray(raw)) {
        var ids = raw.filter(function(x) { return Array.isArray(x) ? x[1] > 0 : true; })
                     .map(function(x) { return Array.isArray(x) ? x[0] : x; });
        currentIds = currentIds.concat(ids);
      }
    }
    var currentIdSet = new Set(currentIds);

    var existingIds = [];
    Object.keys(db.itemsMap).forEach(function(key) {
      var item = db.itemsMap[key];
      if (item.type === type && item.category === "watchlist") existingIds.push(item.filmweb_id);
    });
    var existingIdSet = new Set(existingIds);

    var toAdd = currentIds.filter(function(id) { return !existingIdSet.has(id); });
    var toRemove = existingIds.filter(function(id) { return !currentIdSet.has(id); });

    console.log("  Nowe: " + toAdd.length + " | usuniete: " + toRemove.length + " (z " + currentIds.length + " na liscie)");

    toRemove.forEach(function(id) { delete db.itemsMap[getItemKey(type, id, "watchlist")]; });

    var total = toAdd.length;
    if (total > 0) {
      var phaseStart = Date.now();
      for (var i = 0; i < total; i++) {
        var id = toAdd[i];
        var item = await buildEnrichedItem(id, type, "watchlist", { listName: "Chce zobaczyc" });
        if (item) db.itemsMap[getItemKey(type, id, "watchlist")] = item;

        if ((i + 1) % 15 === 0 || i === total - 1) {
          var elapsed = Date.now() - phaseStart;
          var avg = elapsed / (i + 1);
          var eta = (total - i - 1) * avg;
          console.log("  ... " + (i + 1) + "/" + total + " | pozostalo: ~" + formatDuration(eta));
          saveDb();
        }
      }
    }

    saveDb();
    return { added: toAdd.length, removed: toRemove.length };
  }

  // ── Sync list (robocze + opublikowane) ────────────────────────
  async function syncListsPhase() {
    console.log("[listy] sprawdzanie zmian...");

    var draftIds = await fetchListIds(false);
    var publishedIds = await fetchListIds(true);
    var currentListIdSet = new Set(draftIds.concat(publishedIds));

    var removedLists = 0, removedItemsFromDeletedLists = 0;
    Object.keys(db.listMeta).forEach(function(listIdStr) {
      var listId = Number(listIdStr);
      if (!currentListIdSet.has(listId)) {
        Object.keys(db.itemsMap).forEach(function(key) {
          var item = db.itemsMap[key];
          if (item.category === "list" && Number(item.list_id) === listId) {
            delete db.itemsMap[key];
            removedItemsFromDeletedLists++;
          }
        });
        delete db.listMeta[listIdStr];
        removedLists++;
      }
    });

    var addedItemsTotal = 0, updatedListsCount = 0, removedItemsInLists = 0;
    var groups = [ { ids: draftIds, status: "roboczy" }, { ids: publishedIds, status: "opublikowana" } ];

    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      for (var i = 0; i < group.ids.length; i++) {
        var listId = group.ids[i];
        var details = await fetchListDetails(listId);
        if (!details) continue;

        var modTime = details.modificationTime || "";
        var stored = db.listMeta[listId];

        if (stored && stored.modTime === modTime && stored.status === group.status) {
          continue; // lista bez zmian - pomijamy diff elementow
        }

        updatedListsCount++;
        var listName = details.name || ("Lista " + listId);

        var currentElements = (details.elements || [])
          .filter(function(el) { return el.entityName === "film" || el.entityName === "serial" || el.entityName === "tvshow"; })
          .map(function(el) { return { id: el.entityId, type: el.entityName === "film" ? "movie" : "show" }; });
        var currentElementIdSet = new Set(currentElements.map(function(e) { return e.type + ":" + e.id; }));

        var existingElements = [];
        Object.keys(db.itemsMap).forEach(function(key) {
          var item = db.itemsMap[key];
          if (item.category === "list" && Number(item.list_id) === listId) {
            existingElements.push({ key: key, type: item.type, id: item.filmweb_id });
          }
        });

        existingElements.forEach(function(e) {
          if (!currentElementIdSet.has(e.type + ":" + e.id)) {
            delete db.itemsMap[e.key];
            removedItemsInLists++;
          }
        });

        var existingIdSet = new Set(existingElements.map(function(e) { return e.type + ":" + e.id; }));
        var toAdd = currentElements.filter(function(e) { return !existingIdSet.has(e.type + ":" + e.id); });

        for (var j = 0; j < toAdd.length; j++) {
          var el = toAdd[j];
          var item = await buildEnrichedItem(el.id, el.type, "list", { listName: listName, listId: listId, listStatus: group.status });
          if (item) {
            db.itemsMap[getItemKey(el.type, el.id, "list", listId)] = item;
            addedItemsTotal++;
          }
        }

        existingElements.forEach(function(e) {
          var item = db.itemsMap[e.key];
          if (item && currentElementIdSet.has(e.type + ":" + e.id)) {
            item.list_name = listName;
            item.list_status = group.status;
          }
        });

        db.listMeta[listId] = { modTime: modTime, status: group.status, name: listName };
        saveDb();
      }
    }

    console.log("  Usuniete listy: " + removedLists + " (" + removedItemsFromDeletedLists + " pozycji) | " +
      "Zmienione listy: " + updatedListsCount + " | Nowe pozycje: " + addedItemsTotal + " | Usuniete pozycje: " + removedItemsInLists);

    saveDb();
    return { addedLists: removedLists, updatedLists: updatedListsCount, added: addedItemsTotal, removed: removedItemsFromDeletedLists + removedItemsInLists };
  }

  // ── Eksport CSV ────────────────────────────────────────────────
  function exportCsv(itemsArray) {
    if (itemsArray.length === 0) {
      console.error("[!] Brak danych. Upewnij sie ze jestes zalogowany na filmweb.pl");
      return;
    }

    var COLS = ["type","title","original_title","year","director","filmweb_id","imdb_id",
                "category","user_rating","rated_at","watched_at","comment",
                "list_name","list_id","list_status","favorite","filmweb_rating","vote_count"];

    var csvContent = COLS.join(",") + "\n" +
      itemsArray.map(function(item) {
        return COLS.map(function(c) { return csvEscape(item[c]); }).join(",");
      }).join("\n");

    var today = new Date().toISOString().slice(0, 10);
    var filename = "filmweb_export_" + today + ".csv";
    var blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    console.log("Plik: " + filename);
  }

  // ── Glowny przebieg ──────────────────────────────────────────
  try {
    userId = await fetchUserId();

    console.log("");
    console.log("[favorites] pobieranie...");
    var favorites = await fetchFavorites();
    syncFavoritesFlags(favorites.movieIds, favorites.showIds);

    console.log("");
    var r1 = await syncVotesPhase(["film"], "movie", "filmy ocenione", favorites.movieIds);
    await sleep(1500);

    console.log("");
    var r2 = await syncVotesPhase(["serial", "tvshow"], "show", "seriale ocenione", favorites.showIds);
    await sleep(1500);

    console.log("");
    var r3 = await syncWatchlistPhase(["film"], "movie", "watchlist-filmy");
    await sleep(1500);

    console.log("");
    var r4 = await syncWatchlistPhase(["serial", "tvshow"], "show", "watchlist-seriale");
    await sleep(1500);

    console.log("");
    var r5 = await syncListsPhase();

    db.lastSync = Date.now();
    saveDb();

    var totalElapsed = Date.now() - scriptStartTime;
    var totalItems = Object.keys(db.itemsMap).length;

    console.log("");
    console.log("===============================================");
    console.log("Podsumowanie synchronizacji:");
    console.log("  Filmy ocenione:     +" + r1.added + " / -" + r1.removed + " / ~" + r1.updated);
    console.log("  Seriale ocenione:   +" + r2.added + " / -" + r2.removed + " / ~" + r2.updated);
    console.log("  Watchlist filmy:    +" + r3.added + " / -" + r3.removed);
    console.log("  Watchlist seriale:  +" + r4.added + " / -" + r4.removed);
    console.log("  Listy:              +" + r5.added + " / -" + r5.removed + " (zmienione listy: " + r5.updatedLists + ")");
    console.log("");
    console.log("Lacznie w bazie: " + totalItems + " pozycji");
    if (errors > 0) console.warn("Bledy: " + errors);
    console.log("Czas synchronizacji: " + formatDuration(totalElapsed));
    console.log("===============================================");

    exportCsv(Object.values(db.itemsMap));

  } catch (err) {
    console.error("[!] Przerwano: " + err.message);
    console.log("[!] Postep zapisany w bazie (" + Object.keys(db.itemsMap).length + " pozycji).");
    console.log("[!] Wklej skrypt ponownie po zalogowaniu - sam wykryje co juz zrobiono.");
    saveDb();
    exportCsv(Object.values(db.itemsMap));
    return;
  }

})();