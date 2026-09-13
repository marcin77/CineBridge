"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Film, LayoutDashboard, Upload, FileDown,
  BookOpen, Settings, Info, Download,
} from "lucide-react";
import AboutModal from "./AboutModal";
import UpdateModal from "./UpdateModal";
import ThemeToggle from "./ThemeToggle";
import { useState } from "react";
import { useUpdater } from "@/hooks/use-updater";
import { useScraperSync } from "@/lib/scraper-sync-context";

const links = [
  { href: "/",        label: "Panel",   icon: LayoutDashboard },
  { href: "/import",  label: "Import",  icon: Upload },
  { href: "/export",  label: "Eksport", icon: FileDown },
  { href: "/scraper", label: "Scraper", icon: BookOpen },
];

export default function Nav() {
  const pathname = usePathname();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const { status, updateInfo, progress, errorMessage, downloadUpdate, installUpdate } = useUpdater();
  const { running } = useScraperSync();

  const hasUpdate = status === "available" || status === "downloading" || status === "downloaded";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          {/* Logo */}
          <Link href="/" className="mr-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
              <Film size={15} />
            </span>
            <span>Cine<span className="text-emerald-400">Bridge</span></span>
          </Link>

          {/* Nav links */}
          <nav className="flex flex-1 items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {hasUpdate && (
              <button
                onClick={() => setUpdateOpen(true)}
                className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                title="Dostępna aktualizacja"
              >
                <Download size={14} />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />
              </button>
            )}
            <ThemeToggle />
            <Link
              href="/settings"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname.startsWith("/settings")
                  ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              }`}
              title="Ustawienia"
            >
              <Settings size={14} />
            </Link>
            <button
              onClick={() => setAboutOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              title="O aplikacji"
            >
              <Info size={14} />
            </button>
          </div>
        </div>
      </header>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <UpdateModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        status={status}
        updateVersion={updateInfo?.version ?? null}
        progress={progress}
        errorMessage={errorMessage}
        scraperRunning={running}
        onDownload={downloadUpdate}
        onInstall={installUpdate}
      />
    </>
  );
}