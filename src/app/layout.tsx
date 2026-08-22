import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import { ScraperSyncProvider } from "@/lib/scraper-sync-context";
import { ThemeProvider } from "@/lib/theme-provider";

export const metadata: Metadata = {
  title: "CineBridge – Filmweb Export & Import",
  description: "Eksportuj swoje dane z Filmweb i importuj je do Letterboxd, Trakt i innych serwisów.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="bg-white text-slate-900 antialiased min-h-screen dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ScraperSyncProvider>
            <Nav />
            <main>{children}</main>
          </ScraperSyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}