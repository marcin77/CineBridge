"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5" />
    );
  }

  const themes = [
    { value: "light", label: "Jasny", icon: Sun },
    { value: "dark", label: "Ciemny", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const current = themes.find((t) => t.value === theme) || themes[2];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        aria-label="Przełącz motyw"
      >
        <Icon size={16} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
            {themes.map(({ value, label, icon: ThemeIcon }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition ${
                  theme === value
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                <ThemeIcon size={16} />
                {label}
                {theme === value && (
                  <span className="ml-auto text-xs text-emerald-500 dark:text-emerald-400">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}