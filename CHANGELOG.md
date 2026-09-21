# Changelog

## [1.4.0]

### ✨ Dodano
- **Masowe zarządzanie importami** — checkboxy przy każdym imporcie na stronie `/import`,
  możliwość zaznaczenia wielu importów i usunięcia jednym kliknięciem
- **"Zaznacz wszystkie" / "Odznacz wszystkie"** — szybkie zaznaczanie wszystkich importów
- **"Wyczyść historię"** — usuwa wszystkie importy oprócz najnowszego (zabezpieczenie
  przed przypadkowym usunięciem ostatniego importu)
- **Oznaczenie najnowszego importu** — badge "najnowszy" przy ostatnim imporcie w tabeli
- **Eksport tylko nowych pozycji** — checkbox "Eksportuj tylko nowe pozycje (N nowych)"
  w panelu eksportu; porównuje `source_id` z poprzednimi importami i eksportuje tylko
  pozycje których nie było we wcześniejszych batchach
- **Nazwa pliku eksportu zawiera oznaczenie nowych pozycji** — np.
  `cinebridge-trakt-zip-nowe-16-2026-09-16-filmweb_export_2026-09-16.zip`
- **Nowy endpoint** `DELETE /api/import/batch-delete` — usuwa wiele batchów naraz
  przyjmując tablicę `{ ids: number[] }`
- **Nowy endpoint** `GET /api/import/[batchId]/diff` — porównuje batch z poprzednimi,
  zwraca `{ hasPrevious, newCount, total, items }` z listą nowych pozycji
- **Nowy helper** `src/lib/export-utils.ts` — funkcja `getExportItems(batchId, onlyNew)`
  używana przez wszystkie endpointy eksportu; obsługuje filtrowanie do nowych pozycji
- **Automatyczna aktualizacja `package-lock.json`** — hook `version` w `package.json`
  uruchamia `npm install --package-lock-only && git add package-lock.json` po każdym
  `npm version patch/minor/major`
- **Logowanie wersji w `scripts/build.js`** — `console.log` z   wersją podczas
  budowania, wersja przekazywana jako `NEXT_PUBLIC_APP_VERSION`

### 🎨 Zmieniono
- **Strona `/import`** — tabela importów zastąpiona komponentem `BatchListManager`
  z checkboxami i przyciskami masowego zarządzania; usunięto indywidualny przycisk
  "Usuń" z każdego wiersza (zastąpiony checkboxami)
- **Panel eksportu** — dodano sekcję "Eksportuj tylko nowe pozycje" widoczną tylko
  gdy istnieje poprzedni import i są nowe pozycje (`hasPrevious=true && newCount>0`)
- **Endpointy eksportu** obsługują parametr `?onlyNew=true`:
  `GET /api/import/[batchId]/export`,
  `GET /api/import/[batchId]/export/trakt-zip`,
  `GET /api/import/[batchId]/export/letterboxd-zip`

### 🐛 Naprawiono
- **Trakt CSV — poprawiony format** -  dostosowano pozycje do formatu trakt.tv
- **Trakt CSV — watchlista trafiała do historii** zamiast watchlisty: kolumna
  `watchlisted_at` była pusta gdy Filmweb nie zapisuje daty dodania do watchlisty;
  Trakt interpretował wiersz bez żadnej daty jako historię. Teraz `watchlisted_at`
  otrzymuje datę eksportu jako fallback — Trakt poprawnie rozpoznaje pozycję jako
  watchlistę
- **Trakt CSV — `watched_at` dla obejrzanych bez daty** — zmieniono `?? "unknown"`
  na `|| "unknown"` żeby poprawnie obsłużyć pusty string zwracany przez `formatDate`
  
## [1.3.0]

### ✨ Dodano
- Eksport Trakt ZIP: **komentarze do sezonów i odcinków** — wcześniej pliki
  `comments-seasons.json` i `comments-episodes.json` były zawsze puste (`[]`);
  teraz zawierają prawdziwe komentarze z Filmweb
- Eksport Simkl CSV: kolumna **`LastEpWatched`** — ostatni obejrzany odcinek serialu
  w formacie `S04E08`; wyznaczany na podstawie odcinków z bazy z najwyższym
  numerem sezonu i odcinka
- Universal CSV: kolumny **`matched_title`** i **`matched_year`** osobno od `title`/`year` —
  pełny backup wszystkich pól
- Universal CSV: kolumna **`episode_title_en`** — angielski tytuł odcinka z TMDB;
  `episode_title` zachowuje oryginalny polski tytuł z Filmweb
- Letterboxd CSV/ZIP: kolumny **`tmdbID`** i **`imdbID`** — Letterboxd używa ich do
  precyzyjnego dopasowania bez matchowania po tytule
- TMDB matching: **przycisk "Dopasuj ponownie"** przy załadowaniu strony gdy wszystko
  już dopasowane
- TMDB matching: **automatyczne uzupełnianie angielskich tytułów odcinków** i
  `tmdb_id` sezonów/odcinków po zakończeniu matchingu seriali — działa cicho w tle
- TMDB matching: **pasek postępu uwzględnia odcinki i sezony** w łącznym liczniku
- Schemat bazy: nowa kolumna **`episode_title_en`**
- TMDB matching: `tmdb_id` i `episode_title_en` dla **sezonów bez odcinków** —
  wcześniej sezony które nie mają przypisanych odcinków w bazie były pomijane
  przez endpoint `tmdb-episodes`

### 🐛 Naprawiono
- Eksport wszystkich formatów: `cleanTitle` zamienia `²³¹` na cyfry —
  znaki superscript mogły powodować problemy przy imporcie na serwisach
- Eksport Trakt ZIP: `bestTitle` zamienia `²³¹` na cyfry — spójne z `cleanTitle`
- Eksport Trakt ZIP: **ulubione** (`lists-favorites.json`) były zawsze puste —
  filtr sprawdzał `category = 'favorite'` zamiast kolumny `favorite = 'tak'`
- Eksport Trakt ZIP: **tytuły filmów i seriali po polsku** zamiast angielskich —
  `movieObj()` i `showObj()` używały `i.title` (polski z Filmweb) zamiast
  `matchedTitle ?? originalTitle ?? title`; poprawiono też `slug` i `year`
  (priorytet `matchedYear` nad `year`)
- Eksport Trakt ZIP: slug zawierał błędne znaki dla tytułów z `ł/Ł` —
  `normalize("NFD")` nie konwertuje `ł` (osobny znak Unicode U+0142);
  dodano jawne mapowanie `ł→l`, `Ł→L`, `ø→o`, `ß→ss`, `þ→th`;
  dodano też usuwanie znaków `²³¹®™©` przed slugify
- Eksport Trakt ZIP: pliki `hidden-*.json` (5 plików zawsze pustych) usunięte —
  Filmweb nie ma funkcji ukrywania, pliki nigdy nie zawierały danych
- Eksport Letterboxd: tag `favorite` w kolumnie Tags nigdy się nie pojawiał —
  filtr sprawdzał `category === 'favorite'` zamiast `favorite === 'tak'`
- TMDB matching: `matchedTitle` zapisywał `original_title` z TMDB (koreański,
  japoński, chiński itd.) zamiast `title` (angielski/łaciński) — naprawiono
  zapis w `tmdb-match/route.ts` (`result.title` zamiast `result.originalTitle`)
- TMDB matching: kolejność strategii — najpierw `original_title` (angielski z
   Filmweb),
  potem polski `title`;
- TMDB matching: sanityzacja tytułów przed wysłaniem do API — usuwa znaki `®™©²³¹°•·`
  które blokowały dopasowanie
- TMDB matching: nowa strategia skróconego tytułu — gdy tytuł zawiera `:` i podtytuł
  ma min. 2 słowa, próbuje też części przed dwukropkiem
- TMDB matching: sanityzacja `²→2`, `³→3`, `¹→1` zamiast usuwania
- TMDB matching: kolejność strategii — `original_title` przed `title` powodowała
  błędne dopasowania gdy `original_title` zawierał znaki specjalne 
- TMDB cache: **pełny reset** przy "Wyczyść cache" — czyści cache i resetuje
  `tmdb_id/imdb_id/matched_title/matched_year/tmdb_searched` w `media_items`;
  wcześniej tylko czyścił cache bez resetowania rekordów
- TMDB cache: `matchedTitle` w cache zapisywał `result.originalTitle` (koreański/
  japoński) zamiast `result.title` (angielski) — źródło powracających nie-łacińskich tytułów mimo wielokrotnego czyszczenia cache
- `cleanTitle`: obsługuje typograficzne cudzysłowy `"` `"` (Unicode U+201C/U+201D) —
  naprawia niektóre tytuły zwracane przez TMDB
- „Zakończono" wyświetlało się przed zakończeniem uzupełniania tytułów odcinków —
  przeniesiono `setMatchDone(true)` na koniec pełnego procesu
- Endpoint `tmdb-episodes`: sezony oznaczane jako `tmdb_searched = true`
  nawet gdy TMDB nie ma ich ID — eliminuje nieskończoną pętlę
- Endpoint `tmdb-episodes`: `remaining` liczony po przetworzeniu sezonów
  i uwzględnia zarówno odcinki jak i sezony (`tmdb_searched = false`)
- Endpoint `tmdb-episodes`: sezony z już wypełnionym `tmdb_id` (przez pętlę odcinków)
  ale bez `tmdb_searched = true` były pomijane i powodowały nieskończoną pętlę —
  zmieniono filtr z `isNull(tmdbId)` na `tmdbSearched = false` 
- Pasek postępu: `total` ustalany po pierwszym chunku filmów/seriali,
  następnie powiększany o odcinki/sezony po zakończeniu ich matchingu —
  eliminuje przekraczanie 100% i błędne wartości przy małej liczbie rekordów


### 🎨 Poprawiono
- Eksport Trakt ZIP: `ratingsShows` używa teraz `addChunkedFiles` zamiast
  `zip.file` — spójne z `ratingsMovies`, obsługuje duże kolekcje seriali

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