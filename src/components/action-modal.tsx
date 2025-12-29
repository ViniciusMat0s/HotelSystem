"use client";

import { useEffect } from "react";

type ActionTone = "success" | "error" | "info";

const TONE_STYLES: Record<ActionTone, { label: string; className: string }> = {
  success: {
    label: "Sucesso",
    className: "bg-secondary/20 text-secondary",
  },
  error: {
    label: "Erro",
    className: "bg-primary/20 text-primary",
  },
  info: {
    label: "Info",
    className: "bg-surface-strong text-muted",
  },
};

export function ActionModal({
  open,
  title,
  description,
  details,
  tone = "info",
  onClose,
  actionLabel = "Fechar",
}: {
  open: boolean;
  title: string;
  description?: string;
  details?: string;
  tone?: ActionTone;
  onClose: () => void;
  actionLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const toneStyle = TONE_STYLES[tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
        className="panel-strong w-full max-w-lg rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`pill rounded-full px-3 py-1 text-xs ${toneStyle.className}`}>
            {toneStyle.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
          >
            Fechar
          </button>
        </div>
        <div className="mt-5 space-y-2">
          <h3 id="action-modal-title" className="font-display text-xl text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="text-sm text-muted">{description}</p>
          ) : null}
          {details ? (
            <p className="text-xs text-muted">{details}</p>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
