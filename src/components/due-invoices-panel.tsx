import { Panel, Pill } from "@/components/cards";
import { formatCurrency } from "@/lib/format";

type DueInvoiceItem = {
  id: string;
  provider: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  WATER: "Agua",
  POWER: "Energia",
  INTERNET: "Internet",
  TV: "TV",
  OTHER: "Outros",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SLA_WARNING_DAYS = 7;
const SLA_CRITICAL_DAYS = 15;

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * MS_PER_DAY);

const parseDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return normalizeDate(date);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
};

const escapeCsv = (value: string) => {
  const shouldQuote = /[";\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return shouldQuote ? `"${escaped}"` : escaped;
};

const sumByRange = (items: DueInvoiceItem[], start: Date, end: Date) => {
  let total = 0;
  let count = 0;
  items.forEach((item) => {
    const dueDate = parseDate(item.dueDate);
    if (!dueDate) return;
    if (dueDate < start || dueDate > end) return;
    count += 1;
    total += item.amount;
  });
  return { count, total };
};

export function DueInvoicesPanel({ items }: { items: DueInvoiceItem[] }) {
  const today = normalizeDate(new Date());
  const next7 = addDays(today, 7);
  const next30 = addDays(today, 30);

  const overdueSummary = items.reduce(
    (acc, item) => {
      const dueDate = parseDate(item.dueDate);
      if (!dueDate || dueDate >= today) return acc;
      const daysOverdue = Math.max(
        1,
        Math.round((today.getTime() - dueDate.getTime()) / MS_PER_DAY)
      );
      acc.count += 1;
      acc.total += item.amount;
      acc.maxDays = Math.max(acc.maxDays, daysOverdue);
      return acc;
    },
    { count: 0, total: 0, maxDays: 0 }
  );

  const slaStatus =
    overdueSummary.count === 0
      ? null
      : overdueSummary.maxDays >= SLA_CRITICAL_DAYS
      ? { label: "SLA critico", tone: "critical" as const }
      : overdueSummary.maxDays >= SLA_WARNING_DAYS
      ? { label: "SLA em risco", tone: "warning" as const }
      : { label: "SLA sob controle", tone: "neutral" as const };

  const todayTotals = sumByRange(items, today, today);
  const next7Totals = sumByRange(items, today, next7);
  const next30Totals = sumByRange(items, today, next30);

  const dueItems = items.filter((item) => {
    const dueDate = parseDate(item.dueDate);
    if (!dueDate) return false;
    return dueDate <= next30;
  });

  const providerTotals = dueItems.reduce<Record<string, { total: number; count: number }>>(
    (acc, item) => {
      const key = item.provider;
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0 };
      }
      acc[key].total += item.amount;
      acc[key].count += 1;
      return acc;
    },
    {}
  );

  const providerList = Object.entries(providerTotals)
    .map(([provider, data]) => ({
      provider,
      label: PROVIDER_LABELS[provider] ?? provider,
      total: data.total,
      count: data.count,
    }))
    .sort((a, b) => b.total - a.total);

  const csvRows = [
    [
      "id",
      "fornecedor",
      "fatura",
      "valor",
      "moeda",
      "vencimento",
      "status",
      "notas",
    ],
    ...dueItems.map((item) => [
      item.id,
      PROVIDER_LABELS[item.provider] ?? item.provider,
      item.invoiceNumber ?? "",
      item.amount.toFixed(2),
      item.currency,
      formatDate(item.dueDate),
      item.status,
      item.notes ?? "",
    ]),
  ];

  const csvContent = csvRows
    .map((row) => row.map((value) => escapeCsv(String(value))).join(";"))
    .join("\n");

  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  return (
    <Panel
      title="Contas a vencer"
      description="Resumo com atrasadas, periodo e export rapido."
    >
      <div className="space-y-6 text-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Atrasadas", data: overdueSummary },
            { label: "Hoje", data: todayTotals },
            { label: "Proximos 7 dias", data: next7Totals },
            { label: "Proximos 30 dias", data: next30Totals },
          ].map((item) => (
            <div
              key={item.label}
              className="card-lite rounded-2xl border border-border bg-surface-strong p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {item.label}
              </p>
              <p className="mt-2 font-display text-2xl text-foreground">
                {formatCurrency(item.data.total)}
              </p>
              {item.label === "Atrasadas" ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>
                    {item.data.count} fatura{item.data.count === 1 ? "" : "s"}
                  </span>
                  {overdueSummary.count > 0 ? (
                    <span>Maior atraso: {overdueSummary.maxDays} dias</span>
                  ) : null}
                  {slaStatus ? <Pill tone={slaStatus.tone}>{slaStatus.label}</Pill> : null}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  {item.data.count} fatura{item.data.count === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Total por fornecedor (atrasadas + 30 dias)
            </p>
            <p className="mt-1 text-xs text-muted">
              {dueItems.length === 0
                ? "Sem contas a vencer nos proximos 30 dias."
                : `${dueItems.length} faturas no periodo`}
            </p>
          </div>
          {dueItems.length > 0 ? (
            <a
              className="btn btn-outline btn-sm"
              href={csvHref}
              download="contas-a-vencer.csv"
            >
              Exportar CSV
            </a>
          ) : null}
        </div>

        {providerList.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum fornecedor com faturas pendentes neste periodo.
          </p>
        ) : (
          <div className="space-y-3">
            {providerList.map((provider) => (
              <div
                key={provider.provider}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <div>
                  <p className="font-display text-base text-foreground">
                    {provider.label}
                  </p>
                  <p className="text-xs text-muted">
                    {provider.count} fatura{provider.count === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="font-display text-lg">
                  {formatCurrency(provider.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
