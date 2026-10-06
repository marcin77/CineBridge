process.env.NODE_ENV = "production";

const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const dir = process.env.APP_DIR || path.join(__dirname, "..");
const port = parseInt(process.env.PORT || "3000", 10);

console.log("[NextServer] Katalog aplikacji:", dir);
console.log("[NextServer] DATABASE_PATH:", process.env.DATABASE_PATH);

const serverScript = path.join(dir, "server.js");
console.log("[NextServer] Uruchamiam serwer:", serverScript);

// Uruchom server.js jako osobny proces Node.js (nie require)
const serverProcess = spawn("node", [serverScript], {
  cwd: path.dirname(serverScript),
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  },
  stdio: "inherit",
});

// ── Sprzątanie: nigdy nie zostawiaj prawdziwego serwera bez opiekuna ──
let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { serverProcess.kill("SIGTERM"); } catch {}
  process.exit(code);
}
process.on("disconnect", () => shutdown(0));  // Electron zniknął (też kill -9)
process.on("SIGTERM", () => shutdown(0));     // before-quit → nextServerProcess.kill()
process.on("SIGINT", () => shutdown(0));
process.on("exit", () => { try { serverProcess.kill("SIGTERM"); } catch {} });

serverProcess.on("error", (err) => {
  console.error("[NextServer] Błąd procesu:", err);
  process.exit(1);
});

serverProcess.on("exit", (code) => {
  console.log("[NextServer] Proces serwera zakończony, kod:", code);
  process.exit(code || 1);
});

// Poczekaj aż serwer odpowiada, potem powiadom rodzica
function checkServer(attempts = 0) {
  if (attempts > 30) {
    console.error("[NextServer] Timeout - serwer nie odpowiada");
    shutdown(1);
    return;
  }

  const req = http.get(`http://127.0.0.1:${port}`, (res) => {
    res.resume();
    console.log("[NextServer] Gotowy na porcie", port);
    if (process.send) process.send("ready");
  });

  req.on("error", () => setTimeout(() => checkServer(attempts + 1), 300));
  req.end();
}

setTimeout(() => checkServer(), 1000);