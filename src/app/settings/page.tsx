import SettingsForm from "./SettingsForm";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tmdbApiKey = await getSetting("tmdb_api_key");

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold text-white">Ustawienia</h1>
      <p className="mb-8 text-sm text-slate-400">
        Konfiguracja integracji z zewnętrznymi serwisami.
      </p>

      <SettingsForm hasApiKey={Boolean(tmdbApiKey && tmdbApiKey !== "")} />
    </div>
  );
}