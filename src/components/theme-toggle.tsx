"use client";

import { useBrandingStore, type ThemeMode } from "@/stores/branding-store";

const MODES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Claro" },
  { key: "dark", label: "Escuro" },
  { key: "system", label: "Auto" },
];

export function ThemeToggle() {
  const mode = useBrandingStore((state) => state.mode);
  const setMode = useBrandingStore((state) => state.setMode);

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface-strong p-1 text-xs">
      {MODES.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setMode(item.key)}
          className={`rounded-full px-3 py-1 transition ${
            mode === item.key
              ? "bg-primary text-white shadow-[0_10px_24px_rgba(0,0,0,0.15)]"
              : "text-muted hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
