#!/usr/bin/env node
/**
 * scripts/prepare-electron-build.js
 *
 * Next.js w trybie "output: standalone" tworzy w .next/standalone
 * minimalny serwer Node, ALE świadomie pomija katalog "public" oraz
 * ".next/static" (traktując je jako zasoby, którymi zwykle zajmuje się CDN).
 *
 * Ponieważ pakujemy appkę do działania w 100% offline (Electron),
 * musimy te katalogi dokleić ręcznie do .next/standalone przed
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
    'Brak katalogu .next/standalone. Sprawdź, czy next.config.ts zawiera output: "standalone".'
  );
  process.exit(1);
}

function copyDir(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.warn(`Pominięto (nie istnieje): ${src}`);
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log(`✔ Skopiowano ${label}: ${src} → ${dest}`);
}

// 1. public/ → .next/standalone/public/
copyDir(
  path.join(root, "public"),
  path.join(standaloneDir, "public"),
  "public/"
);

// 2. .next/static/ → .next/standalone/.next/static/
copyDir(
  path.join(root, ".next", "static"),
  path.join(standaloneDir, ".next", "static"),
  ".next/static/"
);

console.log("\n✅ Przygotowanie buildu Electron zakończone.");
console.log(`   Standalone: ${standaloneDir}`);