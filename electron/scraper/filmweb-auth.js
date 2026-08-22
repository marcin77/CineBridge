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

  // 1. Sprawdz czy Electron ma juz zapisana, wazna sesje
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

    const loginWindow = new BrowserWindow({
      width: 480,
      height: 720,
      title: "Logowanie do Filmweb",
      show: false, // pokaz dopiero jesli automatyczne logowanie sie nie uda (np. captcha)
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

    loginWindow.webContents.on("did-finish-load", async () => {
      const url = loginWindow.webContents.getURL();

      if (url.includes("/login")) {
        log("Wypelniam formularz logowania automatycznie...");
        try {
          await loginWindow.webContents.executeJavaScript(
            buildAutofillScript(email, password)
          );
        } catch (e) {
          log("Automatyczne wypelnienie nie powiodlo sie: " + e.message);
        }

        // Jesli po 3 sekundach nadal nie zalogowano (np. pojawila sie captcha),
        // pokaz okno zeby user mogl dokonczyc recznie
        revealTimeout = setTimeout(() => {
          if (!settled && !loginWindow.isDestroyed()) {
            log("Wymagana rekacja uzytkownika (mozliwa captcha) — pokazuje okno.");
            loginWindow.show();
            loginWindow.focus();
          }
        }, 3000);
      }
    });

    loginWindow.loadURL(LOGIN_URL);

    // Sprawdzaj co 1s czy sesja juz jest wazna
    pollInterval = setInterval(checkLoggedIn, 1000);

    // Bezpiecznik - 3 minuty na zalogowanie (w tym reczne rozwiazanie captchy)
    setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(
          new Error(
            "Timeout logowania (3 minuty). Sprawdz dane logowania lub sprobuj ponownie."
          )
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