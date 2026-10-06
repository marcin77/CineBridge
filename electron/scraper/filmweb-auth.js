// electron/scraper/filmweb-auth.js
// Logowanie do Filmweb przez natywne okno Electrona (obsluguje captcha recznie, jesli sie pojawi)

const { BrowserWindow, session } = require("electron");

const PARTITION = "persist:filmweb";
const LOGIN_URL = "https://www.filmweb.pl/login";
const FILMWEB_URL_FILTER = { url: "https://www.filmweb.pl" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cookiesToString(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function extractCsrfToken(cookies) {
  const xsrf = cookies.find((c) => c.name === "XSRF-TOKEN");
  if (xsrf) return decodeURIComponent(xsrf.value);
  const csrf = cookies.find((c) => c.name === "_csrf");
  if (csrf) return decodeURIComponent(csrf.value);
  return null;
}

function isSessionValid(cookies) {
  if (!cookies || !cookies.length) return false;

  const jwt = cookies.find((c) => c.name === "JWT");
  if (!jwt) return false;

  // Electron cookie.expirationDate jest w sekundach (unix timestamp)
  if (jwt.expirationDate) {
    return jwt.expirationDate * 1000 > Date.now() + 5 * 60 * 1000;
  }

  const logged = cookies.find((c) => c.name === "_fwuser_logged");
  return !!logged;
}

async function getStoredCookies() {
  const ses = session.fromPartition(PARTITION);
  return ses.cookies.get(FILMWEB_URL_FILTER);
}

// ─── Skrypt wstrzykiwany na strone logowania ─────────────────────────────────
// Zamyka popup RODO, klika "Kontynuuj z Filmweb", wypelnia formularz i wysyla go.
// Jesli pojawi sie captcha, user musi ja rozwiazac recznie w widocznym oknie.

function buildAutofillScript(email, password) {
  return `
    (function() {
      function setNativeValue(el, value) {
        var lastValue = el.value;
        el.value = value;
        var event = new Event('input', { bubbles: true });
        var tracker = el._valueTracker;
        if (tracker) tracker.setValue(lastValue);
        el.dispatchEvent(event);
      }

      function clickByText(selector, text) {
        var els = Array.from(document.querySelectorAll(selector));
        var el = els.find(function(e) {
          return e.textContent.trim() === text;
        });
        if (el) { el.click(); return true; }
        return false;
      }

      // 1. Zamknij popup RODO (Didomi) jesli jest
      var didomiBtn = document.querySelector("#didomi-notice-agree-button");
      if (didomiBtn) didomiBtn.click();

      // 2. Poczekaj i kliknij "Kontynuuj z Filmweb"
      setTimeout(function() {
        clickByText("button", "Kontynuuj z Filmweb");

        // 3. Poczekaj na formularz i wypelnij
        setTimeout(function() {
          var loginInput = document.querySelector("input[name='login']");
          var passInput = document.querySelector("input[name='password']");
          if (loginInput && passInput) {
            setNativeValue(loginInput, ${JSON.stringify(email)});
            setNativeValue(passInput, ${JSON.stringify(password)});

            setTimeout(function() {
              clickByText("button", "Zaloguj się");
            }, 400);
          }
        }, 800);
      }, 600);
    })();
  `;
}

// ─── Glowna funkcja logowania ─────────────────────────────────────────────────

async function login(email, password, onProgress) {
  const log = (msg) => {
    console.log("[auth]", msg);
    if (onProgress) onProgress({ phase: "auth", message: msg });
  };

  const existingCookies = await getStoredCookies();
  if (isSessionValid(existingCookies)) {
    log("Znaleziono wazna sesje — logowanie pominiete.");
    return {
      cookieString: cookiesToString(existingCookies),
      csrfToken: extractCsrfToken(existingCookies),
    };
  }

  log("Brak waznej sesji — otwieram okno logowania...");

  return new Promise((resolve, reject) => {
    let settled = false;
    let pollInterval = null;
    let revealTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;

    const loginWindow = new BrowserWindow({
      width: 480,
      height: 720,
      title: "Logowanie do Filmweb",
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    function cleanup() {
      if (pollInterval) clearInterval(pollInterval);
      if (revealTimeout) clearTimeout(revealTimeout);
      if (!loginWindow.isDestroyed()) loginWindow.close();
    }

    function failHard(message) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    }

    function attemptLoad() {
      log(
        retryCount === 0
          ? "Laduje strone logowania..."
          : `Ponawiam proba laczenia (${retryCount}/${MAX_RETRIES})...`
      );
      currentAttemptFailed = false; // reset przed kazda proba
      loginWindow.loadURL(LOGIN_URL).catch(() => {});
    }

    async function checkLoggedIn() {
      if (settled) return;
      try {
        const cookies = await getStoredCookies();
        if (isSessionValid(cookies)) {
          settled = true;
          cleanup();
          log("Zalogowano pomyslnie!");
          resolve({
            cookieString: cookiesToString(cookies),
            csrfToken: extractCsrfToken(cookies),
          });
        }
      } catch (e) {
        // ignoruj pojedyncze bledy pollingu
      }
    }

    loginWindow.on("closed", () => {
      if (!settled) {
        settled = true;
        if (pollInterval) clearInterval(pollInterval);
        if (revealTimeout) clearTimeout(revealTimeout);
        reject(
          new Error("Okno logowania zostalo zamkniete przed zakonczeniem logowania.")
        );
      }
    });

    // ── Obsluga nieudanej nawigacji (np. ERR_TIMED_OUT) ──────────────────
loginWindow.webContents.on(
  "did-fail-load",
  (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (settled || !isMainFrame) return;
    if (errorCode === -3) return; // ERR_ABORTED — normalne przy redirectach

    currentAttemptFailed = true; // ← kluczowe: ustawiamy ZANIM did-finish-load zdąży strzelić

    log(`Blad ladowania strony: ${errorDescription} (${errorCode}).`);

    if (revealTimeout) {
      clearTimeout(revealTimeout);
      revealTimeout = null;
    }

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => {
        if (!settled) attemptLoad();
      }, RETRY_DELAY_MS);
    } else {
      log("Nie udalo sie polaczyc z Filmweb po kilku probach — pokazuje okno.");
      if (!loginWindow.isDestroyed()) {
        loginWindow.show();
        loginWindow.focus();
      }
      failHard(
        `Nie udalo sie zaladowac strony logowania (${errorDescription}). ` +
        `Sprawdz polaczenie z internetem i sprobuj ponownie.`
      );
    }
  }
);

loginWindow.webContents.on("did-finish-load", async () => {
  if (currentAttemptFailed) return; // ← ignoruj finish-load po nieudanej nawigacji

  const url = loginWindow.webContents.getURL();
  if (url.startsWith("chrome-error://")) return; // dodatkowe zabezpieczenie, zostaw

  if (url.includes("/login")) {
    log("Wypelniam formularz logowania automatycznie...");
    try {
      await loginWindow.webContents.executeJavaScript(
        buildAutofillScript(email, password)
      );
    } catch (e) {
      log("Automatyczne wypelnienie nie powiodlo sie: " + e.message);
    }

    revealTimeout = setTimeout(() => {
      if (!settled && !loginWindow.isDestroyed()) {
        log("Wymagana rekacja uzytkownika (mozliwa captcha) — pokazuje okno.");
        loginWindow.show();
        loginWindow.focus();
      }
    }, 3000);
  }
});

    attemptLoad();

    pollInterval = setInterval(checkLoggedIn, 1000);

    setTimeout(() => {
      if (!settled) {
        failHard(
          "Timeout logowania (3 minuty). Sprawdz dane logowania lub sprobuj ponownie."
        );
      }
    }, 3 * 60 * 1000);
  });
}

// ─── Wyczysc zapisana sesje (wylogowanie) ────────────────────────────────────

async function clearSession() {
  const ses = session.fromPartition(PARTITION);
  await ses.clearStorageData();
}

module.exports = { login, clearSession, isSessionValid, getStoredCookies };