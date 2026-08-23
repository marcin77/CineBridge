# Changelog

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
- 
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