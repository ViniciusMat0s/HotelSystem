import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "secondary" | "accent";
}) {
  const accentClass =
    accent === "secondary"
      ? "bg-secondary/15 text-secondary"
      : accent === "accent"
      ? "bg-accent/20 text-accent"
      : "bg-primary/15 text-primary";

  return (
    <div className="panel rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
        <span className={`rounded-full px-2 py-1 text-xs ${accentClass}`}>
          live
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-display text-3xl text-foreground">{value}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "critical";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-secondary/20 text-secondary"
      : tone === "warning"
      ? "bg-accent/20 text-accent"
      : tone === "critical"
      ? "bg-primary/20 text-primary"
      : "bg-surface-strong text-muted";

  return (
    <span className={`rounded-full px-3 py-1 text-xs uppercase ${toneClass}`}>
      {children}
    </span>
  );
}
