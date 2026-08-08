"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, LayoutDashboard, Upload, FileDown, BookOpen } from "lucide-react";

const links = [
  { href: "/",       label: "Panel",    icon: LayoutDashboard },
  { href: "/import", label: "Import",   icon: Upload },
  { href: "/export", label: "Eksport",  icon: FileDown },
  { href: "/scraper",label: "Scraper",  icon: BookOpen },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-white mr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
            <Film size={15} />
          </span>
          <span>Cine<span className="text-emerald-400">Bridge</span></span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
