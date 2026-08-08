import { readFileSync } from "fs";
import { join } from "path";
import ScraperClient from "./ScraperClient";

export const dynamic = "force-static";

export default function ScraperPage() {
  // Read the standalone scraper script at build time
  const scriptPath = join(process.cwd(), "public", "filmweb-scraper", "filmweb-scraper.js");
  let scriptContent = "";
  try {
    scriptContent = readFileSync(scriptPath, "utf-8");
  } catch {
    scriptContent = "// Błąd: nie można załadować skryptu.";
  }

  return <ScraperClient scriptContent={scriptContent} />;
}
