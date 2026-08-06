"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, LayoutDashboard, Upload, Cable } from "lucide-react";

const links = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/connections", label: "Połączenia", icon: Cable },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-indigo-500 text-slate-950">
            <Film size={18} />
          </span>
          <span className="text-lg">
            Cine<span className="text-emerald-400">Bridge</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
                  active
                    ? "bg-emerald-400 text-slate-950 font-medium"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
