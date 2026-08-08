import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "CineBridge – Filmweb Export & Import",
  description: "Eksportuj swoje dane z Filmweb i importuj je do Letterboxd, Trakt i innych serwisów.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
