"use client";

import { useEffect } from "react";

type ConfirmTone = "warning" | "danger" | "info";

const TONE_STYLES: Record<ConfirmTone, { label: string; className: string }> = {
  warning: {
    label: "Confirmacao",
    className: "bg-accent/20 text-accent",
  },
  danger: {
    label: "Atencao",
    className: "bg-primary/20 text-primary",
  },
  info: {
    label: "Info",
    className: "bg-surface-strong text-muted",
  },
};

export function ConfirmModal({
  open,
  title,
  description,
  tone = "warning",
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  onConfirm,
  onCancel,
  isBusy = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const toneStyle = TONE_STYLES[tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="panel-strong w-full max-w-lg rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`pill rounded-full px-3 py-1 text-xs ${toneStyle.className}`}>
            {toneStyle.label}
          </span>
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            Fechar
          </button>
        </div>
        <div className="mt-5 space-y-2">
          <h3 className="font-display text-xl text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
