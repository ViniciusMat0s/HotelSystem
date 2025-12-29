"use client";

import { useState } from "react";
import { useBrandingStore, type BrandingColors } from "@/stores/branding-store";

const COLOR_LABELS: { key: keyof BrandingColors; label: string }[] = [
  { key: "background", label: "Fundo" },
  { key: "primary", label: "Primaria" },
  { key: "secondary", label: "Secundaria" },
  { key: "accent", label: "Destaque" },
];

export function BrandingForm() {
  const brandName = useBrandingStore((state) => state.brandName);
  const logoUrl = useBrandingStore((state) => state.logoUrl);
  const colors = useBrandingStore((state) => state.colors);
  const setBrandName = useBrandingStore((state) => state.setBrandName);
  const setLogoUrl = useBrandingStore((state) => state.setLogoUrl);
  const setColor = useBrandingStore((state) => state.setColor);
  const reset = useBrandingStore((state) => state.reset);

  const [localLogo, setLocalLogo] = useState(logoUrl);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Nome da marca
          </span>
          <input
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            className="input-field"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Logo (URL)
          </span>
          <input
            value={localLogo}
            onChange={(event) => setLocalLogo(event.target.value)}
            onBlur={() => setLogoUrl(localLogo)}
            className="input-field"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COLOR_LABELS.map((item) => (
          <label key={item.key} className="space-y-2 text-sm">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              {item.label}
            </span>
            <div className="flex items-center gap-3 card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3">
              <input
                type="color"
                value={colors[item.key]}
                onChange={(event) => setColor(item.key, event.target.value)}
                className="color-swatch"
              />
              <input
                value={colors[item.key]}
                onChange={(event) => setColor(item.key, event.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn btn-outline btn-sm"
        >
          Restaurar padrao
        </button>
        <span className="text-xs text-muted">
          Alteracoes aplicadas automaticamente.
        </span>
      </div>
    </div>
  );
}

