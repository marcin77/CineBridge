const API_BASE = "https://www.filmweb.pl/api/v1";
const SITE_BASE = "https://www.filmweb.pl";
const DEFAULT_DELAY = 800;
const DEFAULT_CONCURRENCY = 3; // konserwatywnie

class FilmwebClient {
  constructor({ cookieString, csrfToken, delay, onProgress, onReauth, concurrency }) {
    this.cookieString = cookieString;
    this.csrfToken = csrfToken;
    this.delay = delay || DEFAULT_DELAY;
    this.initialConcurrency = concurrency ?? DEFAULT_CONCURRENCY;
    this.currentConcurrency = this.initialConcurrency;
    this.onProgress = onProgress || (() => {});
    this.onReauth = onReauth || null;
    this.errors = 0;
    this._reauthPromise = null;

    this.rateLimitedUntil = 0;
    this.consecutive429 = 0;
  }

  async sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  getDelayWithJitter() {
    return this.delay + Math.floor(Math.random() * 250);
  }

  async waitIfRateLimited() {
    if (Date.now() < this.rateLimitedUntil) {
      const waitMs = this.rateLimitedUntil - Date.now();
      this.log(`[throttle] Czekam ${Math.round(waitMs / 1000)}s po rate limit (wspólny dla wszystkich workerów)`);
      await this.sleep(waitMs);
    }
  }

  /**
   * Warstwa sieciowa wspólna dla wywołań JSON (/api/v1/...) i stron HTML
   * (np. /serial/{id}/cast/crew) — cała logika retry/401/429/timeout żyje
   * TYLKO tutaj. fetch() i fetchHtml() różnią się jedynie tym, co robią
   * z odpowiedzią (JSON.parse vs surowy tekst).
   *
   * @param {string} fullUrl - pełny URL (z API_BASE lub SITE_BASE)
   * @param {number} attempt
   * @returns {Promise<string|null>} surowy tekst odpowiedzi, lub null
   *          (błąd, 404, puste body)
   */
  async requestRaw(fullUrl, attempt = 1) {
    await this.waitIfRateLimited();
    await this.sleep(this.getDelayWithJitter());

    const headers = {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      "X-Locale": "pl",
      Cookie: this.cookieString,
    };

    if (this.csrfToken) {
      headers["X-Csrf-Token"] = this.csrfToken;
      headers["X-CSRF-TOKEN"] = this.csrfToken;
    }

    const REQUEST_TIMEOUT_MS = this.requestTimeout || 20000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let resp;
    try {
      resp = await globalThis.fetch(fullUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } catch (e) {
      const timedOut = e.name === "AbortError";
      const errMsg = timedOut ? `brak odpowiedzi po ${REQUEST_TIMEOUT_MS}ms (timeout)` : e.message;

      if (attempt <= 3) {
        this.log(`Blad sieci -> ${fullUrl}: ${errMsg}, retry ${attempt}/3`);
        await this.sleep(2000 * attempt);
        return this.requestRaw(fullUrl, attempt + 1);
      }
      this.log(`Blad sieci -> ${fullUrl}: ${errMsg} (pominięto)`);
      this.errors++;
      return null;
    } finally {
      clearTimeout(timeoutId);
    }

    if (resp.status === 401) {
      if (attempt === 1 && this.onReauth) {
        if (this._reauthPromise) {
          this.log(`[401] Czekam na re-login innego workera...`);
          try {
            await this._reauthPromise;
            return this.requestRaw(fullUrl, 2);
          } catch {
            throw new Error(`SESSION_EXPIRED:${fullUrl}`);
          }
        }

        this.log(`[401] Sesja wygasła — próba ponownego zalogowania...`);
        this._reauthPromise = this.onReauth()
          .then(({ cookieString, csrfToken }) => {
            this.cookieString = cookieString;
            this.csrfToken = csrfToken;
            this.log(`[401] Re-login OK, kontynuuję od ${fullUrl}`);
          })
          .finally(() => {
            this._reauthPromise = null;
          });

        try {
          await this._reauthPromise;
          return this.requestRaw(fullUrl, 2);
        } catch (reauthError) {
          this.log(`[401] Re-login failed: ${reauthError.message}`);
          throw new Error(`SESSION_EXPIRED:${fullUrl}`);
        }
      }

      throw new Error(`SESSION_EXPIRED:${fullUrl}`);
    }

    if (resp.status === 429) {
      this.consecutive429++;

      if (this.consecutive429 >= 3 && this.currentConcurrency > 1) {
        this.log(`[429] UWAGA: ${this.consecutive429} razy 429 pod rząd — zmniejszam równoległość do 1 (tryb bezpieczny)`);
        this.currentConcurrency = 1;
      }

      const backoffSeconds = Math.min(15 * Math.pow(2, this.consecutive429 - 1), 60);
      this.rateLimitedUntil = Date.now() + backoffSeconds * 1000;

      this.log(`[429] Rate limit (${this.consecutive429} pod rząd), czekam ${backoffSeconds}s...`);
      await this.sleep(backoffSeconds * 1000);

      return this.requestRaw(fullUrl, attempt);
    }

    if (resp.status === 404) {
      if (fullUrl.includes('cast/crew')) {
        console.log(`[DEBUG requestRaw] 404 dla ${fullUrl}`);
      }
      // Nie logujemy jako błąd — 404 bywa oczekiwane (np. sezon bez własnego tytułu w API).
      return null;
    }

    if (!resp.ok) {
      this.log(`HTTP ${resp.status} -> ${fullUrl}`);
      this.errors++;
      return null;
    }
    // ── DEBUG tymczasowy ──
    // if (fullUrl.includes('cast/crew')) {
    //   console.log(`[DEBUG requestRaw] żądano=${fullUrl} finalne_url=${resp.url} status=${resp.status} redirected=${resp.redirected}`);
    // }
    if (this.consecutive429 > 0) {
      this.consecutive429 = 0;
    }

    const text = await resp.text();
    // if (fullUrl.includes('cast/crew')) {
    //   console.log(`[DEBUG requestRaw] status=${resp.status} finalUrl=${resp.url} redirected=${resp.redirected} textLen=${text ? text.length : 0}`);
    // }
    if (!text || !text.trim()) return null;
    return text;
  }

  /** Wywołania /api/v1/... — parsuje JSON. */
  async fetch(endpoint, attempt = 1) {
    const text = await this.requestRaw(`${API_BASE}/${endpoint}`, attempt);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      this.log(`Niepoprawny JSON -> ${endpoint}`);
      this.errors++;
      return null;
    }
  }

  /** Zwykłe strony HTML Filmweba (nie /api/v1/) — zwraca surowy tekst. */
  async fetchHtml(path, attempt = 1) {
    return this.requestRaw(`${SITE_BASE}/${path}`, attempt);
  }

  log(msg) {
    console.log("[client]", msg);
    this.onProgress({ phase: "scraper", message: msg });
  }

  // ── Konkretne metody API ───────────────────────────────────

  async getUserInfo() {
    return this.fetch("logged/info");
  }

  async getVotePage(entityName, page) {
    const data = await this.fetch(`logged/vote/title/${entityName}?page=${page}`);
    if (!data || !Array.isArray(data)) return [];
    data.forEach((v) => (v._entityName = entityName));
    return data;
  }

  async getAllVotes(entityName) {
    let page = 1;
    const all = [];
    while (true) {
      const data = await this.getVotePage(entityName, page);
      if (!data.length) break;
      all.push(...data);
      this.log(`  [ok] ${entityName} strona ${page} (${data.length} pozycji)`);
      page++;
    }
    return all;
  }

  async getFavorites(entityName) {
    const data = await this.fetch(`logged/favorites?entityName=${entityName}`);
    return Array.isArray(data) ? data : [];
  }

  async getWantToSee(entityName) {
    const data = await this.fetch(`logged/want2see?entityName=${entityName}`);
    return Array.isArray(data) ? data : [];
  }

  async getTitleInfo(id) {
    return this.fetch(`title/${id}/info`);
  }

  async getTitleRating(id) {
    return this.fetch(`film/${id}/rating`);
  }

  async getTitlePreview(id) {
    return this.fetch(`film/${id}/preview`);
  }

  async getUserVote(userId, entityName, id) {
    return this.fetch(`users/${userId}/votes/${entityName}/${id}`);
  }

  async getUserLists(userId, published, page = 1) {
    return this.fetch(`user/${userId}/lists?page=${page}&published=${published}`);
  }

  async getListDetails(listId) {
    return this.fetch(`lists/${listId}`);
  }

  // ── Sezony / odcinki ───────────────────────────────────────

  /** [{ id, seasonNumber, yearStart, title?: {text, lang}, ... }] */
  async getSeasons(showId) {
    const data = await this.fetch(`serial/${showId}/seasons`);
    return Array.isArray(data) ? data : [];
  }

  /** [{ id, seasonNumber, episodeNumber, duration, seasonId }] */
  async getSeasonEpisodes(showId, seasonNumber) {
    const data = await this.fetch(`serial/${showId}/season/${seasonNumber}/episodes`);
    return Array.isArray(data) ? data : [];
  }

  /** { id, title: { title, lang }, seasonNumber, episodeNumber } */
  async getEpisodeInfo(episodeId) {
    return this.fetch(`episode/${episodeId}/info`);
  }

  /** null gdy brak oceny */
  async getSeasonVote(userId, seasonId) {
    return this.getUserVote(userId, "serialSeason", seasonId);
  }

  /** null gdy brak oceny */
  async getEpisodeVote(userId, episodeId) {
    return this.getUserVote(userId, "filmEpisode", episodeId);
  }

  /** Dla seriali bez sezonów (seasonId: null) — [{ id, episodeNumber, duration }] */
  async getFlatEpisodes(showId) {
    const data = await this.fetch(`serial/${showId}/episodes`);
    return Array.isArray(data) ? data : [];
  }

/**
 * Reżyserzy PRZYPISANI DO KONKRETNEGO SEZONU (nie całego serialu).
 * Filmweb NIE eksponuje tego przez /api/v1/ — dane są tylko w HTML
 * strony obsady/ekipy. Wymaga URL w formacie /serial/{slug}-{rok}-{id}/...
 * — sam numeryczny ID zwraca 404. Slug przed rokiem może być DOWOLNY
 * (Filmweb go ignoruje, liczy się tylko rok+ID), więc używamy stałego
 * placeholdera zamiast rekonstruować prawdziwy tytuł (uniknięcie
 * problemów z transliteracją polskich znaków, apostrofami, dwukropkami).
 *
 * Parsujemy fragment ograniczony do sekcji z nagłówkiem id="director"
 * (unikalny, sprawdzony empirycznie), żeby nie złapać scenarzystów/
 * producentów z sąsiednich sekcji.
 *
 * Zwraca [] jeśli sekcja nie istnieje, rok jest nieznany, lub parsowanie
 * się nie powiedzie (fragile HTML scraping). Wołający powinien traktować
 * pustą listę jako "brak danych", nie błąd, i mieć fallback (np. reżyser
 * całego serialu).
 */
async getSeasonDirectors(showId, seasonNumber, showYear) {
  if (!showYear) return [];

  try {
    const html = await this.fetchHtml(
      `serial/x-${showYear}-${showId}/cast/crew?season=${seasonNumber}`,
    );
    if (!html) return [];

    const headerIdx = html.indexOf('id="director"');
    if (headerIdx === -1) return [];

    const nextHeaderIdx = html.indexOf("filmFullCastSection__header", headerIdx + 1);
    const section = nextHeaderIdx === -1 ? html.slice(headerIdx) : html.slice(headerIdx, nextHeaderIdx);

    const names = [];
    const regex = /<a href="\/person\/[^"]+" data-person-source>([^<]+)<\/a>/g;
    let match;
    while ((match = regex.exec(section)) !== null) {
      names.push(match[1].trim());
    }
    return [...new Set(names)];
  } catch (e) {
    this.log(`[getSeasonDirectors] Błąd parsowania dla ${showId}/season/${seasonNumber}: ${e.message}`);
    return [];
  }
}
}

module.exports = FilmwebClient;