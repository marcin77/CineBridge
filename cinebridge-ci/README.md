# CineBridge — build AppImage (Linux) i .exe (Windows)

Ten katalog (`cinebridge-ci/`) zawiera gotowe pliki do **skopiowania do
repozytorium `marcin77/CineBridge`** (Next.js + Electron + embedded-postgres).
Struktura docelowa w repo:

```
CineBridge/
├─ .github/
│  └─ workflows/
│     └─ build-desktop.yml          <- z cinebridge-ci/.github/workflows/build-desktop.yml
├─ electron/
│  ├─ main.js                       <- z cinebridge-ci/electron/main.js
│  └─ preload.js                    <- z cinebridge-ci/electron/preload.js
├─ scripts/
│  └─ prepare-electron-build.js     <- z cinebridge-ci/scripts/prepare-electron-build.js
├─ build/
│  └─ icon.png                      <- np. public/cinebridge-icon.png z tego szkicu
├─ electron-builder.yml             <- z cinebridge-ci/electron-builder.yml
├─ next.config.ts                   <- dopisać output: "standalone" (patrz package.json.merge.md)
└─ package.json                     <- dopisać pola z package.json.merge.md
```

## Krok po kroku

1. **Skopiuj pliki** z `cinebridge-ci/` do odpowiednich miejsc w repo
   `CineBridge` (patrz drzewko wyżej — ścieżki 1:1, bez prefiksu
   `cinebridge-ci/`).
2. **Ikona aplikacji** — zapisz plik `build/icon.png` (min. 512×512 px,
   PNG z przezroczystością). Możesz użyć wygenerowanej ikony z tego
   podglądu (`public/cinebridge-icon.png`). electron-builder sam wygeneruje
   z niej `.ico` dla Windows i użyje jej na Linuksie.
3. **`next.config.ts`** — dodaj `output: "standalone"` (patrz
   `package.json.merge.md`).
4. **`package.json`** — dodaj pole `"main": "electron/main.js"` oraz nowe
   skrypty (`electron:prepare`, `electron:dev`, `dist:win`, `dist:linux`) —
   dokładna treść w `package.json.merge.md`.
5. **Workflow GitHub Actions** — plik `.github/workflows/build-desktop.yml`
   uruchamia się:
   - automatycznie przy pushu na `main` (build testowy, bez publikacji),
   - automatycznie przy pushu tagu `vX.Y.Z` (build + **automatyczny Release**
     na GitHubie z podpiętymi `.AppImage` i `.exe`),
   - ręcznie z zakładki **Actions → Build Desktop App → Run workflow**.
6. **Wypuszczenie wersji** — żeby dostać gotowe pliki `.AppImage` i `.exe`
   w sekcji **Releases**, wystarczy:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   Po ~5–10 minutach w zakładce *Releases* pojawi się nowy wpis z:
   - `CineBridge-1.0.0.AppImage`
   - `CineBridge-1.0.0-Setup.exe`

## Jak to działa pod spodem

- `next build` (z `output: "standalone"`) tworzy w `.next/standalone`
  samodzielny serwer Node.
- `scripts/prepare-electron-build.js` dokleja do niego `public/` oraz
  `.next/static/` (Next domyślnie ich tam nie kopiuje).
- `electron-builder.yml` pakuje:
  - kod Electrona (`electron/*.js`) do archiwum `.asar`,
  - cały katalog `.next/standalone` jako zasób `app-standalone` (poza `.asar`),
  - binarki `embedded-postgres` wypakowane poza `.asar` (wymagane, bo to
    prawdziwe, wykonywalne procesy systemowe).
- Po odpaleniu appki `electron/main.js`:
  1. startuje wbudowany Postgres w katalogu danych użytkownika,
  2. odpala `server.js` z `.next/standalone` jako osobny proces Node,
  3. otwiera okno i ładuje `http://127.0.0.1:3456`.

Dzięki temu użytkownik końcowy **nie musi instalować** ani Node.js, ani
PostgreSQL — wszystko jest w paczce `.AppImage` / `.exe`.

## Test lokalny przed CI

```bash
npm ci
npm run build
npm run electron:prepare
npm run dist:linux   # na Linuksie -> release/CineBridge-x.y.z.AppImage
npm run dist:win     # na Windows  -> release/CineBridge-x.y.z-Setup.exe
```

electron-builder buduje **tylko** pod system, na którym jest uruchamiany
(Linux → AppImage, Windows → exe) — dlatego workflow w GitHub Actions używa
macierzy `ubuntu-latest` + `windows-latest`, żeby dostać oba pliki w jednym
przebiegu.

## Ewentualne dalsze poprawki

- Jeśli w logach buildu pojawi się błąd o brakującym natywnym module,
  dodaj jego ścieżkę do `asarUnpack` w `electron-builder.yml`.
- Migracje bazy (Drizzle) najlepiej uruchamiać automatycznie przy starcie
  `electron/main.js` (po `startDatabase()`), np. przez
  `drizzle-orm/node-postgres/migrator`.
- Jeśli chcesz też macOS (`.dmg`), dodaj do macierzy `macos-latest`
  i sekcję `mac`/`dmg` w `electron-builder.yml`.
