# Changelog

## [1.2.0]

### ✨ Dodano
- Eksport **Trakt ZIP** — archiwum JSON w formacie backupu trakt.tv (ratings/watched/watchlist/lists,
  filmy + seriale + sezony + odcinki), akceptowane przez serwisy z opcją „Import z Trakt”
- Scraper (desktop): pobieranie **ocen sezonów i odcinków** z Filmweb (opcjonalne, checkbox);
  skanowane są tylko seriale, których ocena zmieniła się od ostatniej synchronizacji
- Nowe kolumny w bazie i uniwersalnym CSV: parent_show_id, season_number, episode_number, episode_title
- Scraper (desktop): obsługa seriali **bez podziału na sezony** (mini-seriale, format flat);
  odcinki zapisywane jako sezon 1
- Liczniki „Sezony” i „Odcinki” na stronie importu, oznaczenia S01E03 w tabeli pozycji
  odcinki zapisywane jako sezon 1
- Checkbox **„Pobieraj oceny sezonów i odcinków"** przeniesiony do osobnego wiersza
  (poprawne wyrównanie, opis pomocniczy pod etykietą)
- TMDB matching: **globalny cache dopasowań** (`traktMatchCache`) — raz dopasowany tytuł
  nie wymaga ponownego odpytania API przy kolejnych synchronizacjach/batchach;
  cache zapisuje też wyniki negatywne (nie szuka ponownie tytułów których TMDB nie zna)
- TMDB matching: **wielokrokowy fallback** — 6 strategii wyszukiwania w kolejności
  (title+rok → title bez roku → originalTitle+rok → originalTitle bez roku →
  title+pl-PL+rok → title+pl-PL bez roku); znacząco poprawia dopasowanie
  polskich i koreańskich tytułów bez angielskich odpowiedników
- Strona importu: kafelek **„Seriale"** (`type = show`) — osobny od „Obejrzane"
  (które liczy filmy + seriale łącznie); grid rozszerzony do 8 kolumn
- TMDB matching: przycisk **„Wyczyść cache"** przy sekcji dopasowywania —
  usuwa zapisane wyniki TMDB (wpisy `tmdb:*`), wymusza ponowne wyszukiwanie;
  nowy endpoint `DELETE /api/tmdb-cache`
- TMDB matching: **pasek postępu** z procentem ukończenia i skumulowanymi sumami
  (Dopasowano / Nie znaleziono / Pozostało) zamiast wartości per-chunk
- **Automatyczne sprawdzanie aktualizacji** aplikacji desktopowej przy uruchomieniu,
  z powiadomieniem w interfejsie o dostępnej nowej wersji
- Pobieranie i instalacja aktualizacji z poziomu aplikacji (pasek postępu pobierania,
  przycisk „Zainstaluj i uruchom ponownie"); proces wymaga potwierdzenia użytkownika
  na każdym etapie, bez automatycznego pobierania czy instalacji w tle
- Ostrzeżenie w oknie aktualizacji, gdy trwa synchronizacja z Filmweb — instalacja
  aktualizacji przerywa proces scrapowania
- **Niedokończony import** — wybrany plik CSV/JSON jest tymczasowo zapisywany lokalnie
  (IndexedDB) i można dokończyć jego import po odświeżeniu strony lub ponownym
  uruchomieniu aplikacji, bez ponownego wskazywania pliku z dysku
- Linux (AppImage): **automatyczna integracja z systemowym menu aplikacji** przy
  pierwszym uruchomieniu — tworzenie wpisu `.desktop`, instalacja ikon w motywie
  systemowym, automatyczna aktualizacja skrótu po zmianie wersji aplikacji

### 🐛 Naprawiono
- Kafelki „Sezony ocenione" i „Odcinki ocenione" pokazywały NaN po zakończeniu synchronizacji
  gdy `includeEpisodes = false` lub scraper nie dotarł do fazy odcinków
  (brak inicjalizacji `seasonsAdded/episodesAdded/showsScanned/showsSkipped` w `this.stats`)
- Klient Filmweb: pusta odpowiedź 200 (brak oceny) nie powoduje już błędu parsowania
- Uniwersalny CSV: kolumna title zawierała tytuł oryginalny zamiast polskiego
- Licznik **„Obejrzane"** na stronie importu zawyżał wartość przez wliczanie sezonów i odcinków
  (dodano filtr `type IN ('movie', 'show')`)
- Dopasowanie TMDB (`tmdb-match`) niepotrzebnie próbowało matchować sezony i odcinki,
  marnując limit API (dodano filtr `type IN ('movie', 'show')`)
- Eksport Trakt ZIP: `Buffer` niekompatybilny z `BodyInit` w Next.js 16 — zamieniono na `Uint8Array`
- Eksport CSV/ZIP: błędna kolejność priorytetu tytułów — `originalTitle` (polski/koreański)
  był używany zamiast `matchedTitle` (angielski z TMDB); naprawiono we wszystkich formatach
  (Letterboxd, Trakt CSV, Simkl, watchlist, listy)
- Podwójne escapowanie tytułów z przecinkiem w CSV scrapera (`csvEscape` wywoływane
  dwukrotnie — raz w `buildItem`, raz w `buildCsv`)
- Scraper: `showScanMeta` nie był zapisywany dla seriali ze standardową strukturą
  sezonów — smart-skip nigdy nie pomijał seriali mimo braku zmian od ostatniego skanu;
  dodano zapis meta po pętli sezonów w `scanShow()`
- Scraper: przy równoczesnych 401 (concurrency=3) każdy worker odpalał własny re-login;
  dodano mutex (`_reauthPromise`) — jeden re-login na raz, pozostałe czekają na wynik
- Scraper: błąd pojedynczego serialu w fazie odcinków przerywał cały run;
  dodano izolację błędów per-serial (try/catch w `syncEpisodes`)
- Linux: CineBridge nie był poprawnie rozpoznawany przez pasek zadań/dock w
  środowiskach GNOME/Zorin po ręcznej aktualizacji wersji AppImage — poprawiono
  powiązanie `WM_CLASS` / `StartupWMClass` z ikoną aplikacji

### 🎨 Poprawiono
- Przebudowane opisy formatów eksportu (Import i Eksport), Trakt ZIP jako zalecany
- Simkl / Trakt CSV pomijają sezony i odcinki (formaty ich nie obsługują)
- Kafelki na stronie importu: kolejność Sezony/Odcinki wstawiona między Watchlist a Ulubione
- Formularz scrapera: checkbox „Zapamiętaj dane" i przycisk „Usuń zapisane dane" w jednym wierszu,
  checkbox „Pobieraj odcinki" z opisem pomocniczym w osobnym wierszu poniżej
- Budowanie pakietów: dodano formaty **deb**, **rpm** (Linux) i **dmg** (macOS);
  workflow CI/CD rozszerzony o build macOS (`macos-latest`) i wszystkie formaty Linuxa
- Scraper: usunięto przycisk „Odśwież" (bez praktycznego zastosowania)
- TMDB matching: usunięto przycisk „Dopasuj 20 pozycji", zostaje tylko „Dopasuj wszystkie"
- Karty formatów eksportu: jednakowa wysokość w rzędzie (`flex flex-col h-full`),
  treść wyrównana do góry

## [1.1.1]

### 🐛 Naprawiono
- Ikona aplikacji w pasku zadań na Linux (AppImage + GNOME/Zorin OS)
- Poprawiono ścieżkę do ikony w trybie produkcyjnym (packaged app)
- Jawne ustawienie ikony przez `mainWindow.setIcon()` po załadowaniu okna
- Dodano `app.setDesktopFileName()` wymagane przez GNOME do poprawnego
  matchowania okna z plikiem `.desktop`

### 🎨 Poprawiono
- Wygenerowano finalne ikony aplikacji (16px–1024px) z brandingiem CineBridge
- Zielony rounded square + biała taśma filmowa (spójne z UI aplikacji)
- Dodano plik źródłowy SVG ikony w `build/icon-source/`
- Usunięto stary placeholder `96x96.png` (nieużywany przez electron-builder)

## [1.1.0]

### 🐛 Naprawiono
- Sortowanie listy pozycji wg daty oceny/obejrzenia (najnowsze na górze)
- Light theme dla wszystkich komponentów UI

### ✨ Dodano
- Dynamiczna wersja aplikacji (synchronizowana z tagiem release)
- Linki wsparcia w oknie "O aplikacji" (GitHub Sponsors, Ko-fi, Buy Me a Coffee, PayPal)

### 🎨 Poprawiono
- CSS: custom scrollbar, focus accessibility, font smoothing
- Dodano brakujące zmienne CSS (--border, --muted-foreground)

## [1.0.0]

### Pierwsze wydanie
- Import z Filmweb (CSV)
- Eksport do Letterboxd, Trakt
- Scraper Filmweb (Electron)
- Dopasowanie TMDB/IMDb