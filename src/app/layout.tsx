import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "CineBridge — migracja Filmweb → Trakt",
  description:
    "Nowoczesne narzędzie do migracji ocen, dat obejrzenia, komentarzy i list z Filmweb do Trakt (i kolejnych serwisów).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-slate-500">
            CineBridge · self-hosted migration toolkit · Filmweb → Trakt (kolejne serwisy w drodze)
          </footer>
        </div>
      </body>
    </html>
  );
}
