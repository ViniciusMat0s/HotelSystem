"use client";

import { useEffect } from "react";
import { useBrandingStore } from "@/stores/branding-store";

const applyBranding = (
  colors: ReturnType<typeof useBrandingStore.getState>["colors"]
) => {
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--secondary", colors.secondary);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--background", colors.background);
  root.style.setProperty("--surface", colors.surface);
  root.style.setProperty("--surface-strong", colors.surface);
};

const resolveSystemMode = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const mode = useBrandingStore((state) => state.mode);
  const colors = useBrandingStore((state) => state.colors);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = mode === "system" ? resolveSystemMode() : mode;
    root.setAttribute("data-theme", resolved);
    applyBranding(colors);
  }, [mode, colors]);

  useEffect(() => {
    if (mode !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.setAttribute(
        "data-theme",
        resolveSystemMode()
      );
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [mode]);

  return children;
}
