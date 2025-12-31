"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type MonthlyReservationItem = {
  key: string;
  label: string;
  reservedCount: number;
  canceledCount: number;
  totalAmount: number;
};

const formatCount = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const buildSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};

export function MonthlyReservationsChart({
  items,
}: {
  items: MonthlyReservationItem[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Sem dados de reservas.</p>;
  }

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [lastActiveIndex, setLastActiveIndex] = useState<number | null>(null);

  const maxValue = Math.max(
    1,
    ...items.map((item) => Math.max(item.reservedCount, item.canceledCount))
  );
  const totalReserved = items.reduce((sum, item) => sum + item.reservedCount, 0);
  const totalCanceled = items.reduce((sum, item) => sum + item.canceledCount, 0);

  const chartWidth = 1000;
  const chartHeight = 240;
  const paddingX = 18;
  const paddingTop = 20;
  const paddingBottom = 26;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const baseY = paddingTop + innerHeight;
  const step = items.length > 1 ? innerWidth / (items.length - 1) : 0;

  const points = items.map((item, index) => {
    const x = paddingX + index * step;
    const reservedY = paddingTop + (1 - item.reservedCount / maxValue) * innerHeight;
    const canceledY = paddingTop + (1 - item.canceledCount / maxValue) * innerHeight;
    return {
      x,
      reservedY,
      canceledY,
      label: item.label,
      key: item.key,
      reservedCount: item.reservedCount,
      canceledCount: item.canceledCount,
      totalAmount: item.totalAmount,
    };
  });

  const reservedLine = buildSmoothPath(
    points.map((point) => ({ x: point.x, y: point.reservedY }))
  );
  const canceledLine = buildSmoothPath(
    points.map((point) => ({ x: point.x, y: point.canceledY }))
  );

  const reservedArea = reservedLine
    ? `${reservedLine} L ${points[points.length - 1].x} ${baseY} L ${
        points[0].x
      } ${baseY} Z`
    : "";
  const canceledArea = canceledLine
    ? `${canceledLine} L ${points[points.length - 1].x} ${baseY} L ${
        points[0].x
      } ${baseY} Z`
    : "";

  const hoverIndex = activeIndex ?? lastActiveIndex;
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const isActive = activeIndex !== null;
  const leftPercent = hoverPoint ? (hoverPoint.x / chartWidth) * 100 : 50;
  const tooltipLeft = `${Math.max(8, Math.min(92, leftPercent))}%`;

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Ultimos 12 meses
          </p>
          <p className="mt-1 font-display text-xl text-foreground">
            {formatCount(totalReserved)} reservas
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatCount(totalCanceled)} canceladas
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_12px_rgba(96,165,250,0.7)]" />
            Reservas
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(244,114,182,0.7)]" />
            Cancelamentos
          </span>
        </div>
      </div>

      <div
        className="group relative rounded-3xl border border-white/10 bg-surface/30 px-4 py-4 backdrop-blur-2xl transition-all duration-500 ease-out hover:border-white/20"
        style={{ boxShadow: "var(--shadow-tight)" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/5" />
        <div className="relative h-[240px] w-full">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label="Grafico mensal de reservas e cancelamentos"
          >
            <defs>
              <linearGradient id="chart-bg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--surface-strong)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="reserved-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="canceled-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
              <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
                <path
                  d="M 64 0 L 0 0 0 64"
                  stroke="var(--border)"
                  strokeOpacity="0.32"
                  strokeWidth="1"
                  fill="none"
                />
              </pattern>
              <filter id="glow-secondary" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="8"
                  floodColor="var(--secondary)"
                  floodOpacity="0.6"
                />
              </filter>
              <filter id="glow-accent" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="8"
                  floodColor="var(--accent)"
                  floodOpacity="0.55"
                />
              </filter>
            </defs>

            <rect width={chartWidth} height={chartHeight} fill="url(#chart-bg)" />
            <rect width={chartWidth} height={chartHeight} fill="url(#grid)" />

            {reservedArea ? (
              <path
                d={reservedArea}
                fill="url(#reserved-area)"
                className="transition-opacity duration-500 ease-out opacity-80 group-hover:opacity-100"
              />
            ) : null}
            {canceledArea ? (
              <path
                d={canceledArea}
                fill="url(#canceled-area)"
                className="transition-opacity duration-500 ease-out opacity-70 group-hover:opacity-95"
              />
            ) : null}

            {reservedLine ? (
              <path
                d={reservedLine}
                fill="none"
                stroke="currentColor"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-secondary transition-opacity duration-500 ease-out opacity-90 group-hover:opacity-100"
                filter="url(#glow-secondary)"
              />
            ) : null}
            {canceledLine ? (
              <path
                d={canceledLine}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent transition-opacity duration-500 ease-out opacity-85 group-hover:opacity-100"
                filter="url(#glow-accent)"
              />
            ) : null}

            {hoverPoint ? (
              <>
                <line
                  x1={hoverPoint.x}
                  x2={hoverPoint.x}
                  y1={paddingTop}
                  y2={baseY}
                  stroke="currentColor"
                  className={`text-white/20 transition-opacity duration-300 ease-out ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                  strokeDasharray="4 6"
                />
              </>
            ) : null}
          </svg>

          {hoverPoint ? (
            <div
              className={`pointer-events-none absolute top-4 z-20 -translate-x-1/2 transition-all duration-300 ease-out ${
                isActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
              }`}
              style={{ left: tooltipLeft }}
            >
              <div className="min-w-[180px] rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-foreground backdrop-blur-2xl">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  {hoverPoint.label}
                </p>
                <p className="mt-1 text-sm font-display">
                  {formatCount(hoverPoint.reservedCount)} reservas
                </p>
                <p className="text-xs text-muted">
                  {formatCount(hoverPoint.canceledCount)} canceladas
                </p>
                <p className="mt-1 text-xs text-foreground">
                  {formatCurrency(hoverPoint.totalAmount)}
                </p>
              </div>
            </div>
          ) : null}

          <div
            className="absolute inset-0 z-10 grid"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          >
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className="h-full w-full cursor-pointer bg-transparent"
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setLastActiveIndex(index);
                }}
                onFocus={() => {
                  setActiveIndex(index);
                  setLastActiveIndex(index);
                }}
                onMouseLeave={() => setActiveIndex(null)}
                onBlur={() => setActiveIndex(null)}
                aria-label={`${item.label} ${formatCount(
                  item.reservedCount
                )} reservas, ${formatCount(
                  item.canceledCount
                )} canceladas, ${formatCurrency(item.totalAmount)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
