"use client";
import { useEffect, useState } from "react";

const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export function useAppVersion() {
  const [version, setVersion] = useState(BUILD_VERSION);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getAppVersion) return;
    api.getAppVersion().then(setVersion).catch(() => {});
  }, []);

  return version;
}