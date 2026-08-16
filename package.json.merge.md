# Zmiany w `package.json` repozytorium CineBridge

Poniższe pola trzeba dodać/scalić z istniejącym `package.json` w repo
`marcin77/CineBridge` (Next.js). Nie nadpisuj całego pliku — dołóż tylko
brakujące klucze do istniejących sekcji `scripts` i dodaj `main`.

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",

    "electron:prepare": "node scripts/prepare-electron-build.js",
    "electron:dev": "concurrently -k \"npm:dev\" \"wait-on tcp:3000 && electron .\"",

    "dist:win": "npm run electron:prepare && electron-builder --win --config electron-builder.yml",
    "dist:linux": "npm run electron:prepare && electron-builder --linux AppImage --config electron-builder.yml"
  }
}
```

## Dodatkowa zależność

W repo jest już `embedded-postgres`, `electron` i `electron-builder` w
`devDependencies` — nic więcej nie trzeba instalować. Jeśli finalnie main
proces będzie łączył się z `pg`/`drizzle-orm` bezpośrednio, upewnij się
tylko, że `pg` jest w `dependencies` (już jest).

## `next.config.ts`

Dodaj `output: "standalone"`, żeby `next build` wygenerował samodzielny
serwer możliwy do spakowania z Electronem:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```
