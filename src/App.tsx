import { CodeBlock } from "./components/CodeBlock";
import {
  generatedFiles,
  scriptsSnippet,
  nextConfigSnippet,
  triggerSnippet,
  releaseCommands,
  localTestCommands,
  steps,
} from "./data/pipeline";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 max-w-3xl">
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-slate-400">{description}</p>}
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-96 w-96 rounded-full bg-blue-700/20 blur-3xl" />
      </div>

      <div className="relative">
        {/* Nav */}
        <header className="border-b border-white/5">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <img
                src="/cinebridge-icon.png"
                alt="CineBridge"
                className="h-9 w-9 rounded-lg shadow-lg shadow-violet-900/40"
              />
              <span className="text-lg font-bold tracking-tight text-white">CineBridge</span>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
                Desktop Build Pipeline
              </span>
            </div>
            <a
              href="https://github.com/marcin77/CineBridge"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg border border-slate-700 px-3.5 py-1.5 text-sm font-medium text-slate-300 transition hover:border-violet-500 hover:text-white sm:inline-block"
            >
              github.com/marcin77/CineBridge ↗
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr,0.8fr]">
            <div>
              <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
                GitHub Actions · Electron · Next.js
              </p>
              <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Buduj <span className="text-violet-400">.AppImage</span> i{" "}
                <span className="text-blue-400">.exe</span> automatycznie
              </h1>
              <p className="mt-5 text-lg text-slate-400">
                Przygotowałem kompletny zestaw plików potrzebnych do spakowania CineBridge jako
                aplikacji desktopowej (Electron + wbudowany Postgres) oraz workflow GitHub Actions,
                który przy każdym tagu wersji sam zbuduje instalator dla Linuksa i Windowsa.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <p className="text-2xl font-bold text-violet-300">🐧 AppImage</p>
                  <p className="text-xs text-slate-500">build na ubuntu-latest</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <p className="text-2xl font-bold text-blue-300">🪟 .exe (NSIS)</p>
                  <p className="text-xs text-slate-500">build na windows-latest</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <p className="text-2xl font-bold text-emerald-300">🚀 Auto Release</p>
                  <p className="text-xs text-slate-500">przy pushu tagu v*.*.*</p>
                </div>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-600/30 to-blue-600/30 blur-2xl" />
              <img
                src="/cinebridge-icon.png"
                alt="Ikona CineBridge"
                className="relative w-full rounded-3xl border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* Files generated */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading
            eyebrow="Krok 1 — pliki"
            title="Wygenerowane pliki, gotowe do skopiowania"
            description="Wszystkie leżą w tym projekcie w katalogu cinebridge-ci/ — skopiuj je 1:1 (bez tego prefiksu) do repozytorium marcin77/CineBridge."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {generatedFiles.map((file) => (
              <div
                key={file.path}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-violet-500/40"
              >
                <p className="font-mono text-[13px] text-violet-300">{file.path}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">→ {file.targetPath}</p>
                <p className="mt-3 text-sm text-slate-400">{file.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading
            eyebrow="Krok 2 — wdrożenie"
            title="Instrukcja krok po kroku"
          />
          <ol className="grid gap-4 sm:grid-cols-2">
            {steps.map((step) => (
              <li
                key={step.title}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* How the pipeline triggers */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading
            eyebrow="Krok 3 — wyzwalanie workflow"
            title="Kiedy odpala się build?"
            description="Fragment .github/workflows/build-desktop.yml odpowiadający za wyzwalacze:"
          />
          <CodeBlock code={triggerSnippet} language="yaml" />

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">
                Wypchnięcie zmian i wydanie wersji:
              </p>
              <CodeBlock code={releaseCommands} language="bash" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">
                Test lokalny przed CI (opcjonalnie):
              </p>
              <CodeBlock code={localTestCommands} language="bash" />
            </div>
          </div>
        </section>

        {/* Config snippets */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading
            eyebrow="Krok 4 — konfiguracja"
            title="Zmiany w package.json i next.config.ts"
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">
                Dodaj do <code className="text-violet-300">package.json</code>:
              </p>
              <CodeBlock code={scriptsSnippet} language="json" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">
                Zaktualizuj <code className="text-violet-300">next.config.ts</code>:
              </p>
              <CodeBlock code={nextConfigSnippet} language="typescript" />
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading
            eyebrow="Jak to działa pod spodem"
            title="Architektura spakowanej aplikacji"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-3xl">🐘</p>
              <p className="mt-2 font-semibold text-white">Wbudowany Postgres</p>
              <p className="mt-2 text-sm text-slate-400">
                embedded-postgres startuje lokalną bazę w katalogu danych użytkownika — bez
                instalowania czegokolwiek przez odbiorcę appki.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-3xl">▲</p>
              <p className="mt-2 font-semibold text-white">Serwer Next.js (standalone)</p>
              <p className="mt-2 text-sm text-slate-400">
                electron/main.js odpala server.js z .next/standalone jako osobny proces Node i
                łączy go z bazą przez DATABASE_URL.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-3xl">🖥️</p>
              <p className="mt-2 font-semibold text-white">Okno Electrona</p>
              <p className="mt-2 text-sm text-slate-400">
                Po starcie serwera aplikacja otwiera BrowserWindow i ładuje
                http://127.0.0.1:3456 — dla użytkownika wygląda jak zwykły program.
              </p>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeading eyebrow="Uwagi" title="Dobrze wiedzieć" />
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              electron-builder buduje instalator tylko pod system, na którym jest uruchamiany —
              dlatego workflow używa macierzy{" "}
              <code className="text-violet-300">ubuntu-latest</code> +{" "}
              <code className="text-violet-300">windows-latest</code>, aby w jednym przebiegu
              powstały oba pliki.
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              Jeśli w logach pojawi się błąd o brakującym module natywnym, dodaj jego ścieżkę do{" "}
              <code className="text-violet-300">asarUnpack</code> w{" "}
              <code className="text-violet-300">electron-builder.yml</code>.
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              Migracje bazy (Drizzle) najlepiej uruchamiać automatycznie w{" "}
              <code className="text-violet-300">electron/main.js</code> zaraz po starcie bazy.
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              Chcesz też wersję macOS (.dmg)? Dodaj{" "}
              <code className="text-violet-300">macos-latest</code> do macierzy oraz sekcję{" "}
              <code className="text-violet-300">mac</code> w konfiguracji electron-buildera.
            </li>
          </ul>
        </section>

        <footer className="border-t border-white/5 py-10 text-center text-sm text-slate-500">
          Pliki gotowe do skopiowania znajdziesz w katalogu{" "}
          <code className="text-violet-300">cinebridge-ci/</code> tego projektu, wraz z pełnym{" "}
          <code className="text-violet-300">README.md</code>.
        </footer>
      </div>
    </div>
  );
}

export default App;
