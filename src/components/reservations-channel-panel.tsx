import { Panel, Pill } from "@/components/cards";
import { formatPercent } from "@/lib/format";

type ChannelSummaryItem = {
  source: string;
  count: number;
  canceledCount: number;
  rate: number;
};

type CancelRateItem = {
  key: string;
  label: string;
  totalCount: number;
  canceledCount: number;
  rate: number;
};

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Direto",
  BOOKING: "Booking",
  WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in",
  OTA: "OTA",
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

function CancellationRateChart({ items }: { items: CancelRateItem[] }) {
  const maxRate = 1;
  const chartWidth = 420;
  const chartHeight = 180;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 32;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const baseY = paddingTop + innerHeight;
  const step = items.length > 1 ? innerWidth / (items.length - 1) : 0;

  const points = items.map((item, index) => {
    const x = paddingX + index * step;
    const y = paddingTop + (1 - item.rate / maxRate) * innerHeight;
    return {
      x,
      y,
      label: item.label,
      rate: item.rate,
      key: item.key,
    };
  });

  const line = buildSmoothPath(points.map((point) => ({ x: point.x, y: point.y })));
  const area = line
    ? `${line} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
    : "";

  const avgRate =
    items.length > 0
      ? items.reduce((sum, item) => sum + item.rate, 0) / items.length
      : 0;

  const labelIndices = [0, Math.floor(items.length / 2), items.length - 1].filter(
    (value, index, array) => array.indexOf(value) === index
  );

  return (
    <div className="card-lite rounded-2xl border border-border/70 bg-surface/60 p-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Taxa de cancelamento</span>
        <span>Media: {formatPercent(avgRate)}</span>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="mt-3 h-36 w-full"
        role="img"
        aria-label="Taxa mensal de cancelamento"
      >
        <defs>
          <linearGradient id="cancel-rate-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <pattern id="cancel-grid" width="70" height="70" patternUnits="userSpaceOnUse">
            <path
              d="M 70 0 L 0 0 0 70"
              stroke="var(--border)"
              strokeOpacity="0.3"
              strokeWidth="1"
              fill="none"
            />
          </pattern>
        </defs>

        <rect width={chartWidth} height={chartHeight} fill="url(#cancel-grid)" />
        {area ? <path d={area} fill="url(#cancel-rate-area)" /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          />
        ) : null}

        {labelIndices.map((index) => {
          const point = points[index];
          return (
            <text
              key={point.key}
              x={point.x}
              y={chartHeight - 8}
              textAnchor="middle"
              fontSize="9"
              className="fill-muted"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function ReservationsChannelPanel({
  sources,
  cancelRateByMonth,
}: {
  sources: ChannelSummaryItem[];
  cancelRateByMonth: CancelRateItem[];
}) {
  const getTone = (rate: number) => {
    if (rate >= 0.35) return "critical";
    if (rate >= 0.2) return "warning";
    return "neutral";
  };

  return (
    <Panel
      title="Canais e cancelamentos"
      description="Resumo por canal e taxa mensal de cancelamento."
    >
      <div className="space-y-4 text-sm">
        {sources.length === 0 ? (
          <p className="text-sm text-muted">Sem reservas no periodo.</p>
        ) : (
          <div className="space-y-3">
            {sources.map((item) => (
              <div
                key={item.source}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/70 px-4 py-3"
              >
                <div>
                  <p className="font-display text-base text-foreground">
                    {SOURCE_LABELS[item.source] ?? item.source}
                  </p>
                  <p className="text-xs text-muted">
                    {formatCount(item.count)} reservas
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{formatCount(item.canceledCount)} canc.</span>
                  <Pill tone={getTone(item.rate)}>{formatPercent(item.rate)}</Pill>
                </div>
              </div>
            ))}
          </div>
        )}

        <CancellationRateChart items={cancelRateByMonth} />
      </div>
    </Panel>
  );
}
