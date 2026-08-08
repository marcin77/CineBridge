"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, LogOut, ExternalLink } from "lucide-react";

interface Status {
  configured: boolean;
  connected: boolean;
  username: string | null;
}

export default function TraktConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [device, setDevice] = useState<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/trakt/status");
    setStatus(await res.json());
  }

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startConnect() {
    setError(null);
    const res = await fetch("/api/trakt/device/start", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setDevice(data);

    pollRef.current = setInterval(async () => {
      const pollRes = await fetch("/api/trakt/device/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode: data.device_code }),
      });
      const pollData = await pollRes.json();
      if (pollData.status === "success") {
        if (pollRef.current) clearInterval(pollRef.current);
        setDevice(null);
        await loadStatus();
      } else if (["expired", "denied"].includes(pollData.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError("Autoryzacja wygasła lub została odrzucona. Spróbuj ponownie.");
        setDevice(null);
      }
    }, (data.interval ?? 5) * 1000);
  }

  async function disconnect() {
    await fetch("/api/trakt/disconnect", { method: "POST" });
    await loadStatus();
  }

  if (!status) return <div className="text-slate-400">Ładowanie…</div>;

  if (!status.configured) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-200">
        <p className="mb-2 font-medium">Trakt nie jest jeszcze skonfigurowany</p>
        <p className="mb-3 text-amber-200/80">
          Aby włączyć dopasowywanie tytułów i synchronizację, załóż darmową aplikację API na{" "}
          <a href="https://trakt.tv/oauth/applications" target="_blank" className="underline">
            trakt.tv/oauth/applications
          </a>{" "}
          (jako Redirect URI możesz wpisać <code className="rounded bg-black/30 px-1">urn:ietf:wg:oauth:2.0:oob</code>),
          a następnie ustaw zmienne środowiskowe <code className="rounded bg-black/30 px-1">TRAKT_CLIENT_ID</code> i{" "}
          <code className="rounded bg-black/30 px-1">TRAKT_CLIENT_SECRET</code> w konfiguracji Twojego środowiska.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      {status.connected ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <div className="font-medium text-white">Połączono z Trakt</div>
              <div className="text-sm text-slate-400">{status.username ?? "Konto aktywne"}</div>
            </div>
          </div>
          <button
            onClick={disconnect}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
          >
            <LogOut size={14} /> Rozłącz
          </button>
        </div>
      ) : device ? (
        <div className="text-center">
          <p className="mb-2 text-sm text-slate-400">
            Otwórz poniższy adres na dowolnym urządzeniu i wpisz kod autoryzacyjny:
          </p>
          <a
            href={device.verification_url}
            target="_blank"
            className="mb-4 inline-flex items-center gap-1.5 text-emerald-300 hover:underline"
          >
            {device.verification_url} <ExternalLink size={14} />
          </a>
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="rounded-lg bg-slate-900 px-6 py-3 text-3xl font-bold tracking-[0.3em] text-white">
              {device.user_code}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(device.user_code)}
              className="rounded-lg border border-white/15 p-3 text-slate-300 hover:bg-white/10"
            >
              <Copy size={16} />
            </button>
          </div>
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Oczekiwanie na potwierdzenie…
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-white">Konto Trakt nie jest połączone</div>
            <p className="text-sm text-slate-400">Połącz konto, aby móc synchronizować historię, oceny i listy.</p>
          </div>
          <button
            onClick={startConnect}
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-300"
          >
            Połącz z Trakt
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
