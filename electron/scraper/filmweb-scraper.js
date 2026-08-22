const FilmwebClient = require("./filmweb-client");

function formatDate(dateNumber) {
  const s = dateNumber ? dateNumber.toString() : "";
  if (!s || s.length < 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDuration(ms) {
  if (ms < 0 || !isFinite(ms)) ms = 0;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

class FilmwebScraper {
  constructor({ client, db, onProgress, signal, testLimit, onCheckpoint, checkpointEvery }) {
    this.client = client;
    this.db = db;
    this.onProgress = onProgress || (() => {});
    this.signal = signal;
    this.testLimit = testLimit || null;
    this.onCheckpoint = onCheckpoint || (() => {});
    this.checkpointEvery = checkpointEvery || 50;
    this.userId = null;
    this.favoriteMovieIds = new Set();
    this.favoriteShowIds = new Set();
    this.stats = {
      moviesAdded: 0, moviesRemoved: 0, moviesUpdated: 0,
      showsAdded: 0, showsRemoved: 0, showsUpdated: 0,
      watchlistAdded: 0, watchlistRemoved: 0,
      listsAdded: 0, listsRemoved: 0, listsUpdated: 0,
    };
    this.concurrencyDropped = false; // czy concurrency spadło w trakcie
  }

  // Pomocnik - przytnij tablice jesli jest ustawiony testLimit
  applyLimit(arr) {
    if (this.testLimit && arr.length > this.testLimit) {
      return arr.slice(0, this.testLimit);
    }
    return arr;
  }

  checkAbort() {
    if (this.signal && this.signal.aborted) {
      throw new Error("ABORTED");
    }
  }

  log(msg, extra = {}) {
    console.log("[scraper]", msg);
    this.onProgress({ message: msg, ...extra });
  }

  progress(current, total, phase) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    this.onProgress({ phase, current, total, percent: pct });
  }

  getItemKey(type, id, category, listId) {
    if (category === "list") return `${type}:${id}:list:${listId}`;
    return `${type}:${id}:${category}`;
  }

  // ── Wzbogacanie pojedynczej pozycji ─────────────────────────
async buildItem(id, type, category, opts = {}) {
  this.checkAbort();

  const info = await this.client.getTitleInfo(id);
  if (!info) return null;

  let comment = "";
  let director = "";

  // Komentarz - tylko dla obejrzanych
  if (category === "watched") {
    if (opts.entityName && this.userId) {
      const vote = await this.client.getUserVote(
        this.userId,
        opts.entityName,
        id
      );
      comment = vote?.comment || "";
    }
  }

  // Rezyser - dla wszystkich kategorii
  const preview = await this.client.getTitlePreview(id);
  if (preview?.directors?.length) {
    director = preview.directors.map((d) => d.name).join("; ");
  }

  const isFavorite =
    category === "watched"
      ? type === "movie"
        ? this.favoriteMovieIds.has(id)
        : this.favoriteShowIds.has(id)
      : false;

  return {
    type,
    title: csvEscape(info.title || ""),
    original_title: csvEscape(info.originalTitle || ""),
    year: info.year || "",
    director: csvEscape(director),
    filmweb_id: id,
    category,
    user_rating: opts.rate && opts.rate > 0 ? opts.rate : "",
    rated_at: opts.viewDate || "",
    watched_at: opts.viewDate || "",
    comment,
    list_name: opts.listName || "",
    list_id: opts.listId || "",
    list_status: opts.listStatus || "",
    favorite: isFavorite ? "tak" : "nie",
  };
}

  /**
   * Przetwarza listę elementów w paczkach (chunks) z równoległością dynamicznie
   * dostosowującą się do stanu client.currentConcurrency.
   * @param {Array} items - lista elementów do przetworzenia
   * @param {Function} processFn - async funkcja przetwarzająca pojedynczy element (item, index)
   * @param {Object} opts - { chunkSize, phase, total, onProgress }
   */
  async processInChunks(items, processFn, opts = {}) {
    const chunkSize = opts.chunkSize || 30;
    const phase = opts.phase || "processing";
    const total = items.length;
    let processed = 0;
    const phaseStart = Date.now();

    // Podziel na paczki
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      this.checkAbort();

      // Sprawdź aktualną równoległość (może się zmienić między paczkami)
      const concurrency = this.client.currentConcurrency;

      // Jeśli concurrency spadło, zapisz flagę (do raportu końcowego)
      if (concurrency < this.client.initialConcurrency && !this.concurrencyDropped) {
        this.concurrencyDropped = true;
        this.log(`[${phase}] Równoległość zmniejszona do ${concurrency} z powodu rate limitów.`);
      }

      // Workery: każdy worker bierze kolejny element z chunka
      let chunkIndex = 0;
      const workers = [];

      for (let w = 0; w < concurrency; w++) {
        workers.push(
          (async () => {
            while (chunkIndex < chunk.length) {
              const localIdx = chunkIndex++;
              if (localIdx >= chunk.length) break;

              this.checkAbort();
              const item = chunk[localIdx];
              const globalIdx = processed + localIdx;

              await processFn(item, globalIdx);

              // Checkpoint co N elementów
              if ((globalIdx + 1) % this.checkpointEvery === 0) {
                this.onCheckpoint();
              }
            }
          })()
        );
      }

      await Promise.all(workers);
      processed += chunk.length;

      // Progress update
      const elapsed = Date.now() - phaseStart;
      const avg = elapsed / processed;
      const eta = (total - processed) * avg;

      this.onProgress({
        phase,
        current: processed,
        total,
        percent: Math.round((processed / total) * 100),
        elapsed: formatDuration(elapsed),
        eta: formatDuration(eta),
        message: `[${phase}] ${processed}/${total} | ETA: ~${formatDuration(eta)} | concurrency: ${this.client.currentConcurrency}`,
      });
    }

    // Końcowy checkpoint
    this.onCheckpoint();
  }

  // ── Faza 0: userId + ulubione ────────────────────────────────
  async syncMeta() {
    this.log("Pobieranie danych uzytkownika...", { phase: "meta" });

    const info = await this.client.getUserInfo();
    if (!info?.id) throw new Error("Nie udalo sie pobrac danych uzytkownika");
    this.userId = info.id;
    this.log(`Zalogowany jako: ${info.name} (ID: ${info.id})`);

    // Ulubione
    const filmFav = await this.client.getFavorites("film");
    const serialFav = await this.client.getFavorites("serial");
    const tvshowFav = await this.client.getFavorites("tvshow");

    filmFav.forEach((v) => v.entity && this.favoriteMovieIds.add(v.entity));
    serialFav.forEach((v) => v.entity && this.favoriteShowIds.add(v.entity));
    tvshowFav.forEach((v) => v.entity && this.favoriteShowIds.add(v.entity));

    // Zaktualizuj flagi ulubionych dla juz istniejacych pozycji w bazie
    let updatedFavs = 0;
    for (const key of Object.keys(this.db.itemsMap)) {
      const item = this.db.itemsMap[key];
      if (item.category !== "watched") continue;
      const isFav =
        item.type === "movie"
          ? this.favoriteMovieIds.has(item.filmweb_id)
          : this.favoriteShowIds.has(item.filmweb_id);
      const newVal = isFav ? "tak" : "nie";
      if (item.favorite !== newVal) {
        item.favorite = newVal;
        updatedFavs++;
      }
    }

    this.log(
      `Ulubione: ${this.favoriteMovieIds.size} filmow, ` +
        `${this.favoriteShowIds.size} seriali. ` +
        `Zaktualizowano flag: ${updatedFavs}`
    );
  }

   // ── Faza 1+2: ocenione filmy/seriale (równolegle) ─────────────────────────
  async syncVotes(entityNames, type) {
    const label = type === "movie" ? "filmy" : "seriale";
    this.log(`Sprawdzanie ocenionych (${label})...`, { phase: label });

    let rawVotes = [];
    for (const ent of entityNames) {
      const votes = await this.client.getAllVotes(ent);
      rawVotes = rawVotes.concat(votes);
    }

    const currentMap = new Map();
    for (const v of rawVotes) {
      const id = v.entity || v.id;
      if (id) {
        currentMap.set(id, {
          id,
          rate: v.rate || null,
          viewDate: formatDate(v.viewDate),
          entityName: v._entityName,
        });
      }
    }

    const existingKeys = Object.keys(this.db.itemsMap).filter((k) => {
      const item = this.db.itemsMap[k];
      return item.type === type && item.category === "watched";
    });
    const existingIds = new Set(
      existingKeys.map((k) => this.db.itemsMap[k].filmweb_id)
    );

    const toAdd = [...currentMap.keys()].filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !currentMap.has(id));
    const toUpdate = [...currentMap.keys()].filter((id) => {
      if (!existingIds.has(id)) return false;
      const key = this.getItemKey(type, id, "watched");
      const stored = this.db.itemsMap[key];
      if (!stored) return false;
      const current = currentMap.get(id);
      return (
        String(stored.user_rating) !== String(current.rate || "") ||
        stored.rated_at !== current.viewDate
      );
    });

    this.log(
      `${label}: +${toAdd.length} nowych / -${toRemove.length} usunietych / ~${toUpdate.length} zmienionych / ${currentMap.size - toAdd.length - toUpdate.length} bez zmian`
    );

    for (const id of toRemove) {
      delete this.db.itemsMap[this.getItemKey(type, id, "watched")];
    }

    const toProcess = this.applyLimit([...toAdd, ...toUpdate]);

    if (toProcess.length > 0) {
      await this.processInChunks(
        toProcess,
        async (id) => {
          const voteData = currentMap.get(id);
          const item = await this.buildItem(id, type, "watched", {
            entityName: voteData.entityName,
            rate: voteData.rate,
            viewDate: voteData.viewDate,
          });
          if (item) {
            this.db.itemsMap[this.getItemKey(type, id, "watched")] = item;
          }
        },
        { phase: label, chunkSize: 30 }
      );
    }

    if (type === "movie") {
      this.stats.moviesAdded = toAdd.length;
      this.stats.moviesRemoved = toRemove.length;
      this.stats.moviesUpdated = toUpdate.length;
    } else {
      this.stats.showsAdded = toAdd.length;
      this.stats.showsRemoved = toRemove.length;
      this.stats.showsUpdated = toUpdate.length;
    }
  }

  // ── Faza 3+4: watchlista (równolegle) ─────────────────────────────────────
  async syncWatchlist(entityNames, type) {
    const label = type === "movie" ? "watchlist-filmy" : "watchlist-seriale";
    this.log(`Sprawdzanie watchlisty (${label})...`, { phase: label });

    let currentIds = [];
    for (const ent of entityNames) {
      const raw = await this.client.getWantToSee(ent);
      if (Array.isArray(raw)) {
        const ids = raw
          .filter((x) => (Array.isArray(x) ? x[1] > 0 : true))
          .map((x) => (Array.isArray(x) ? x[0] : x));
        currentIds = currentIds.concat(ids);
      }
    }
    const currentIdSet = new Set(currentIds);

    const existingIds = new Set(
      Object.keys(this.db.itemsMap)
        .filter((k) => {
          const item = this.db.itemsMap[k];
          return item.type === type && item.category === "watchlist";
        })
        .map((k) => this.db.itemsMap[k].filmweb_id)
    );

    const toAdd = this.applyLimit(
      currentIds.filter((id) => !existingIds.has(id))
    );
    const toRemove = [...existingIds].filter((id) => !currentIdSet.has(id));
    
    this.log(
      `${label}: +${toAdd.length} nowych / -${toRemove.length} usunietych`
    );

    for (const id of toRemove) {
      delete this.db.itemsMap[this.getItemKey(type, id, "watchlist")];
    }

    if (toAdd.length > 0) {
      await this.processInChunks(
        toAdd,
        async (id) => {
          const item = await this.buildItem(id, type, "watchlist", {
            listName: "Chce zobaczyc",
          });
          if (item) {
            this.db.itemsMap[this.getItemKey(type, id, "watchlist")] = item;
          }
        },
        { phase: label, chunkSize: 30 }
      );
    }

    if (type === "movie") {
      this.stats.watchlistAdded += toAdd.length;
      this.stats.watchlistRemoved += toRemove.length;
    } else {
      this.stats.watchlistAdded += toAdd.length;
      this.stats.watchlistRemoved += toRemove.length;
    }
  }

  // ── Faza 5: listy (równolegle wewnątrz każdej listy) ────────────────────────
  async syncLists() {
    this.log("Sprawdzanie list...", { phase: "listy" });

    const draftData = await this.client.getUserLists(this.userId, false);
    const publishedData = await this.client.getUserLists(this.userId, true);

    const draftIds = (draftData?.elements || []).map((e) => e.listId);
    const publishedIds = (publishedData?.elements || []).map((e) => e.listId);
    const currentListIdSet = new Set([...draftIds, ...publishedIds]);

    this.log(
      `Listy: ${draftIds.length} roboczych, ${publishedIds.length} opublikowanych`
    );

    // Usun usuniete listy
    for (const listIdStr of Object.keys(this.db.listMeta)) {
      if (!currentListIdSet.has(Number(listIdStr))) {
        for (const key of Object.keys(this.db.itemsMap)) {
          if (
            this.db.itemsMap[key].category === "list" &&
            Number(this.db.itemsMap[key].list_id) === Number(listIdStr)
          ) {
            delete this.db.itemsMap[key];
            this.stats.listsRemoved++;
          }
        }
        delete this.db.listMeta[listIdStr];
      }
    }

    // Sync kazdej listy
    const groups = [
      { ids: draftIds, status: "roboczy" },
      { ids: publishedIds, status: "opublikowana" },
    ];

    for (const group of groups) {
      const idsToProcess = this.applyLimit(group.ids);
      for (const listId of idsToProcess) {
        this.checkAbort();
        const details = await this.client.getListDetails(listId);
        if (!details) continue;

        const modTime = details.modificationTime || "";
        const stored = this.db.listMeta[listId];

        if (stored?.modTime === modTime && stored?.status === group.status) {
          continue;
        }

        this.stats.listsUpdated++;
        const listName = details.name || `Lista ${listId}`;

        const currentElements = (details.elements || [])
          .filter((el) =>
            ["film", "serial", "tvshow"].includes(el.entityName)
          )
          .map((el) => ({
            id: el.entityId,
            type: el.entityName === "film" ? "movie" : "show",
            entityName: el.entityName,
          }));

        const currentElemSet = new Set(
          currentElements.map((e) => `${e.type}:${e.id}`)
        );

        // Usun elementy ktore zniknely z listy
        for (const key of Object.keys(this.db.itemsMap)) {
          const item = this.db.itemsMap[key];
          if (
            item.category === "list" &&
            Number(item.list_id) === listId &&
            !currentElemSet.has(`${item.type}:${item.filmweb_id}`)
          ) {
            delete this.db.itemsMap[key];
          }
        }

        const existingElemSet = new Set(
          Object.keys(this.db.itemsMap)
            .filter((k) => {
              const item = this.db.itemsMap[k];
              return (
                item.category === "list" && Number(item.list_id) === listId
              );
            })
            .map((k) => {
              const item = this.db.itemsMap[k];
              return `${item.type}:${item.filmweb_id}`;
            })
        );

        const toAdd = currentElements.filter(
          (e) => !existingElemSet.has(`${e.type}:${e.id}`)
        );

        if (toAdd.length > 0) {
          await this.processInChunks(
            toAdd,
            async (el) => {
              const item = await this.buildItem(el.id, el.type, "list", {
                listName,
                listId,
                listStatus: group.status,
              });
              if (item) {
                this.db.itemsMap[
                  this.getItemKey(el.type, el.id, "list", listId)
                ] = item;
                this.stats.listsAdded++;
              }
            },
            { phase: "listy", chunkSize: 30 }
          );
        }

        // Zaktualizuj nazwe i status dla istniejacych
        for (const key of Object.keys(this.db.itemsMap)) {
          const item = this.db.itemsMap[key];
          if (item.category === "list" && Number(item.list_id) === listId) {
            item.list_name = listName;
            item.list_status = group.status;
          }
        }

        this.db.listMeta[listId] = {
          modTime,
          status: group.status,
          name: listName,
        };
      }
    }
  }

  // ── Glowny przebieg ──────────────────────────────────────────
  async sync() {
    await this.syncMeta();
    await this.syncVotes(["film"], "movie");
    await this.syncVotes(["serial", "tvshow"], "show");
    await this.syncWatchlist(["film"], "movie");
    await this.syncWatchlist(["serial", "tvshow"], "show");
    await this.syncLists();
    this.db.lastSync = Date.now();
    
    // Dodaj flagę do stats jeśli concurrency spadło
    if (this.concurrencyDropped) {
      this.stats.concurrencyDropped = true;
    }
    
    return this.stats;
  }
}

module.exports = FilmwebScraper;