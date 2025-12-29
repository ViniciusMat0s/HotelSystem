"use client";

import { useEffect } from "react";
import { useBrandingStore } from "@/stores/branding-store";

type RgbColor = { r: number; g: number; b: number };

const hexToRgb = (value: string): RgbColor | null => {
  const hex = value.replace("#", "").trim();
  if (hex.length !== 3 && hex.length !== 6) {
    return null;
  }
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) {
    return null;
  }
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;

const mixColors = (from: RgbColor, to: RgbColor, amount: number): RgbColor => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
});

const luminance = ({ r, g, b }: RgbColor) => {
  const [rs, gs, bs] = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return rs * 0.2126 + gs * 0.7152 + bs * 0.0722;
};

const hexToRgba = (value: string, alpha: number) => {
  const rgb = hexToRgb(value);
  if (!rgb) {
    return null;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const applyBranding = (
  colors: ReturnType<typeof useBrandingStore.getState>["colors"]
) => {
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-strong", colors.primary);
  root.style.setProperty("--secondary", colors.secondary);
  root.style.setProperty("--secondary-strong", colors.secondary);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-strong", colors.accent);

  const fallbackBackground = { r: 3, g: 7, b: 18 };
  const backgroundInput = hexToRgb(colors.background);
  const background = backgroundInput ?? fallbackBackground;
  const backgroundHex = backgroundInput
    ? colors.background
    : rgbToHex(fallbackBackground);
  const isDark = luminance(background) < 0.45;
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  const backgroundStrong = rgbToHex(
    mixColors(background, isDark ? black : white, 0.08)
  );
  const surface = rgbToHex(
    mixColors(background, white, isDark ? 0.08 : 0.7)
  );
  const surfaceStrong = rgbToHex(
    mixColors(background, white, isDark ? 0.16 : 0.88)
  );
  const border = rgbToHex(
    mixColors(background, isDark ? white : black, isDark ? 0.2 : 0.1)
  );
  const foreground = isDark ? "#f9fafb" : "#0b0f1f";
  const mutedBase = isDark
    ? { r: 249, g: 250, b: 251 }
    : { r: 11, g: 15, b: 31 };
  const muted = rgbToHex(
    mixColors(mutedBase, background, isDark ? 0.45 : 0.55)
  );

  root.style.setProperty("--background", backgroundHex);
  root.style.setProperty("--background-strong", backgroundStrong);
  root.style.setProperty("--foreground", foreground);
  root.style.setProperty("--surface", surface);
  root.style.setProperty("--surface-strong", surfaceStrong);
  root.style.setProperty("--border", border);
  root.style.setProperty("--muted", muted);

  const ringAlpha = isDark ? 0.35 : 0.25;
  const glowPrimaryAlpha = isDark ? 0.32 : 0.18;
  const glowSecondaryAlpha = isDark ? 0.28 : 0.18;
  const glowAccentAlpha = isDark ? 0.24 : 0.16;

  const ring = hexToRgba(colors.primary, ringAlpha);
  const glowPrimary = hexToRgba(colors.primary, glowPrimaryAlpha);
  const glowSecondary = hexToRgba(colors.secondary, glowSecondaryAlpha);
  const glowAccent = hexToRgba(colors.accent, glowAccentAlpha);

  if (ring) {
    root.style.setProperty("--ring", ring);
  }
  if (glowPrimary) {
    root.style.setProperty("--glow-primary", glowPrimary);
  }
  if (glowSecondary) {
    root.style.setProperty("--glow-secondary", glowSecondary);
  }
  if (glowAccent) {
    root.style.setProperty("--glow-accent", glowAccent);
  }

  const shadowGlow =
    ring && glowSecondary
      ? isDark
        ? `0 0 0 1px ${ring}, 0 22px 40px ${glowSecondary}`
        : `0 0 0 1px ${ring}, 0 18px 36px ${glowSecondary}`
      : null;
  if (shadowGlow) {
    root.style.setProperty("--shadow-glow", shadowGlow);
  }

  root.style.colorScheme = isDark ? "dark" : "light";
  root.style.setProperty(
    "--shadow-soft",
    isDark ? "0 30px 60px rgba(0, 0, 0, 0.45)" : "0 30px 60px rgba(21, 24, 39, 0.1)"
  );
  root.style.setProperty(
    "--shadow-tight",
    isDark ? "0 18px 34px rgba(0, 0, 0, 0.4)" : "0 18px 36px rgba(21, 24, 39, 0.12)"
  );
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const colors = useBrandingStore((state) => state.colors);

  useEffect(() => {
    applyBranding(colors);
  }, [colors]);

  return children;
}
