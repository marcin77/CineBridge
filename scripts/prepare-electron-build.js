#!/usr/bin/env node
/**
 * Docelowa ścieżka w repo: scripts/prepare-electron-build.js
 *
 * Next.js w trybie "output: standalone" tworzy w .next/standalone
 * minimalny serwer Node, ALE świadomie pomija katalog "public" oraz
 * ".next/static" (traktując je jako zasoby, którymi zwykle zajmuje się CDN).
 *
 * Ponieważ pakujemy appkę do działania w 100% offline (Electron),
 * musimy te katalogi doklejć ręcznie do .next/standalone przed
 * odpaleniem electron-buildera.
 *
 * Uruchamiane jako: npm run electron:prepare (po "npm run build").
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.error(
    'Brak katalogu .next/standalone. Sprawdź, czy next.config.ts zawiera "output: \'standalone\'".'
  );
  process.exit(1);
}

function copyDir(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.warn(`Pominięto (nie istnieje): ${src}`);
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log(`✔ Skopiowano ${label}: ${src} -> ${dest}`);
}

copyDir(path.join(root, "public"), path.join(standaloneDir, "public"), "public/");
copyDir(
  path.join(root, ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
  ".next/static/"
);

console.log("Gotowe — .next/standalone jest gotowy do spakowania przez electron-builder.");
