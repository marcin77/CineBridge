import { promises as fs } from "fs";
import path from "path";
import ScraperPageClient from "./ScraperPageClient";

export const dynamic = "force-dynamic";

async function loadScript() {
  try {
    const scriptPath = path.join(process.cwd(), "public", "filmweb-scraper", "filmweb-scraper.js");
    return await fs.readFile(scriptPath, "utf-8");
  } catch (err) {
    console.error("[scraper/page] Nie udało się wczytać skryptu:", err);
    return "// Błąd wczytywania skryptu — sprawdź czy plik public/filmweb-scraper/filmweb-scraper.js istnieje";
  }
}

export default async function ScraperPage() {
  const scriptContent = await loadScript();
  return <ScraperPageClient scriptContent={scriptContent} />;
}