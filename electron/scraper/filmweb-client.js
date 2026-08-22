const BASE = "https://www.filmweb.pl/api/v1";
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
    
    // Circuit breaker state (wspólny dla wszystkich workerów)
    this.rateLimitedUntil = 0; // timestamp do którego czekamy po 429
    this.consecutive429 = 0;   // 429 pod rząd — po 3 → concurrency=1
  }

  async sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Jitter: dodaj losowe 0-250ms do delay, żeby wzorzec nie był miarowy
  getDelayWithJitter() {
    return this.delay + Math.floor(Math.random() * 250);
  }

  // Czekaj jeśli jesteśmy w stanie globalnej blokady po 429
  async waitIfRateLimited() {
    if (Date.now() < this.rateLimitedUntil) {
      const waitMs = this.rateLimitedUntil - Date.now();
      this.log(`[throttle] Czekam ${Math.round(waitMs / 1000)}s po rate limit (wspólny dla wszystkich workerów)`);
      await this.sleep(waitMs);
    }
  }

  async fetch(endpoint, attempt = 1) {
    await this.waitIfRateLimited();
    await this.sleep(this.getDelayWithJitter());

    const headers = {
      Accept: "application/json",
      "X-Locale": "pl",
      Cookie: this.cookieString,
    };

    if (this.csrfToken) {
      headers["X-Csrf-Token"] = this.csrfToken;
      headers["X-CSRF-TOKEN"] = this.csrfToken;
    }

    let resp;
    try {
      resp = await globalThis.fetch(`${BASE}/${endpoint}`, {
        method: "GET",
        headers,
      });
    } catch (e) {
      // Retry dla błędów sieciowych
      if (attempt <= 3) {
        this.log(`Blad sieci -> ${endpoint}: ${e.message}, retry ${attempt}/3`);
        await this.sleep(2000 * attempt);
        return this.fetch(endpoint, attempt + 1);
      }
      this.log(`Blad sieci -> ${endpoint}: ${e.message} (pominięto)`);
      this.errors++;
      return null;
    }

    if (resp.status === 401) {
      if (attempt <= 3) {
        this.log(`[401] proba ${attempt}/3 dla ${endpoint}`);
        await this.sleep(1500 * attempt);
        return this.fetch(endpoint, attempt + 1);
      }

      if (this.onReauth && attempt === 4) {
        this.log(`[401] Sesja wygasła — próba ponownego zalogowania...`);
        try {
          const { cookieString, csrfToken } = await this.onReauth();
          this.cookieString = cookieString;
          this.csrfToken = csrfToken;
          this.log(`[401] Re-login OK, kontynuuję od ${endpoint}`);
          return this.fetch(endpoint, 1);
        } catch (reauthError) {
          this.log(`[401] Re-login failed: ${reauthError.message}`);
          throw new Error(`SESSION_EXPIRED:${endpoint}`);
        }
      }

      throw new Error(`SESSION_EXPIRED:${endpoint}`);
    }

    if (resp.status === 429) {
      this.consecutive429++;
      
      // Circuit breaker: po 3 429 pod rząd, spada do concurrency=1 na zawsze
      if (this.consecutive429 >= 3 && this.currentConcurrency > 1) {
        this.log(`[429] UWAGA: ${this.consecutive429} razy 429 pod rząd — zmniejszam równoległość do 1 (tryb bezpieczny)`);
        this.currentConcurrency = 1;
      }

      // Globalny throttle: wszystkie workery będą czekać przez ten sam czas
      const backoffSeconds = Math.min(15 * Math.pow(2, this.consecutive429 - 1), 60);
      this.rateLimitedUntil = Date.now() + backoffSeconds * 1000;
      
      this.log(`[429] Rate limit (${this.consecutive429} pod rząd), czekam ${backoffSeconds}s...`);
      await this.sleep(backoffSeconds * 1000);
      
      // Retry po odczekaniu (attempt bez zmian, bo nie chcemy eskalować do SESSION_EXPIRED)
      return this.fetch(endpoint, attempt);
    }

    if (!resp.ok) {
      this.log(`HTTP ${resp.status} -> ${endpoint}`);
      this.errors++;
      return null;
    }

    // Sukces — resetuj licznik 429
    if (this.consecutive429 > 0) {
      this.consecutive429 = 0;
    }
    
    return resp.json();
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
    const data = await this.fetch(
      `logged/vote/title/${entityName}?page=${page}`
    );
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
    return this.fetch(
      `user/${userId}/lists?page=${page}&published=${published}`
    );
  }

  async getListDetails(listId) {
    return this.fetch(`lists/${listId}`);
  }
}

module.exports = FilmwebClient;