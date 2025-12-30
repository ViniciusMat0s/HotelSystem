import { Panel } from "@/components/cards";
import { FinancialEntriesManager } from "@/components/financial-entries-manager";
import { ExpenseIngestForm } from "@/components/expense-ingest-form";
import { RecurringExpensesManager } from "@/components/recurring-expenses-manager";
import { formatCurrency } from "@/lib/format";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { getProfitBreakdown, getRevenueSummary } from "@/lib/reports/finance";

const PERIOD_LABELS: Record<string, string> = {
  day: "Dia",
  week: "Semana",
  month: "Mes",
  quarter: "Trimestre",
  year: "Ano",
};

const PROFIT_CENTER_LABELS: Record<string, string> = {
  ROOM: "Hospedagem",
  PACKAGE: "Pacotes",
  CONSUMPTION: "Consumo (restaurante/cafe)",
  OTHER: "Outros",
};

const ROOM_CATEGORY_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  DELUXE: "Deluxe",
  SUITE: "Suite",
  FAMILY: "Familia",
  VILLA: "Villa",
  OTHER: "Outro",
  OUTROS: "Outros",
};

const PACKAGE_LABELS: Record<string, string> = {
  PADRAO: "Padrao",
  OUTROS: "Outros",
};

const PROVIDER_LABELS: Record<string, string> = {
  WATER: "Agua",
  POWER: "Energia",
  INTERNET: "Internet",
  TV: "TV",
  OTHER: "Outros",
};

const formatDate = (value?: Date | null) => {
  if (!value) return "--";
  return value.toLocaleDateString("pt-BR");
};

export default async function FinancePage() {
  const hotel = await ensureDefaultHotel();
  const revenue = await getRevenueSummary(hotel.id);
  const profit = await getProfitBreakdown(hotel.id);

  const profitByCenter = [...profit.byCenter].sort((a, b) => b.total - a.total);
  const profitByPackage = [...profit.byPackage].sort((a, b) => b.total - a.total);
  const profitByRoom = [...profit.byRoom].sort((a, b) => b.total - a.total);

  const entries = await prisma.financialEntry.findMany({
    where: { hotelId: hotel.id },
    orderBy: { occurredAt: "desc" },
    take: 120,
  });

  const entryItems = entries.map((entry) => ({
    id: entry.id,
    occurredAt: entry.occurredAt.toISOString(),
    type: entry.type,
    category: entry.category,
    profitCenter: entry.profitCenter,
    roomCategory: entry.roomCategory ?? null,
    packageType: entry.packageType ?? null,
    description: entry.description ?? null,
    grossAmount: entry.grossAmount ? entry.grossAmount.toString() : null,
    netAmount: entry.netAmount.toString(),
    taxAmount: entry.taxAmount ? entry.taxAmount.toString() : null,
    currency: entry.currency,
    seasonType: entry.seasonType ?? null,
    source: entry.source,
    reservationId: entry.reservationId ?? null,
  }));

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { hotelId: hotel.id },
    orderBy: { nextRunAt: "asc" },
  });

  const recurringItems = recurringExpenses.map((item) => ({
    id: item.id,
    name: item.name,
    provider: item.provider,
    description: item.description ?? null,
    amount: item.amount.toString(),
    currency: item.currency,
    category: item.category,
    profitCenter: item.profitCenter,
    seasonType: item.seasonType ?? null,
    frequency: item.frequency,
    interval: item.interval,
    nextRunAt: item.nextRunAt.toISOString(),
    lastRunAt: item.lastRunAt ? item.lastRunAt.toISOString() : null,
    active: item.active,
  }));

  const invoices = await prisma.expenseInvoice.findMany({
    where: { hotelId: hotel.id },
    orderBy: { receivedAt: "desc" },
    take: 6,
  });

  return (
    <div className="space-y-8">
      <Panel
        title="Motor financeiro"
        description="Receita por periodo com separacao alta/baixa temporada."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(revenue).map(([period, values]) => (
            <div
              key={period}
              className="card-lite rounded-2xl border border-border bg-surface-strong p-4 text-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {PERIOD_LABELS[period] ?? period}
              </p>
              <p className="mt-2 font-display text-2xl text-foreground">
                {formatCurrency(values.total)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                <span>Alta: {formatCurrency(values.highSeason)}</span>
                <span>Baixa: {formatCurrency(values.lowSeason)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Lancamentos financeiros"
        description="Controle manual de receitas e despesas."
      >
        <FinancialEntriesManager entries={entryItems} />
      </Panel>

      <Panel
        title="Recorrencias de despesas"
        description="Agende contas fixas para gerar lancamentos automaticos."
      >
        <RecurringExpensesManager items={recurringItems} />
      </Panel>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Gestao de lucros"
          description="Consumo, pacotes e tipos de quarto."
        >
          <div className="space-y-4 text-sm">
            <div className="card-lite rounded-2xl border border-border bg-surface-strong p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Lucro por centro
              </p>
              <div className="mt-3 space-y-2">
                {profitByCenter.length === 0 ? (
                  <p className="text-sm text-muted">Sem entradas financeiras.</p>
                ) : (
                  profitByCenter.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="uppercase text-muted">
                        {PROFIT_CENTER_LABELS[item.key] ?? item.key}
                      </span>
                      <span className="font-display">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-lite rounded-2xl border border-border bg-surface-strong p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Lucro por pacote
                </p>
                <div className="mt-2 space-y-2">
                  {profitByPackage.length === 0 ? (
                    <p className="text-sm text-muted">Sem pacotes registrados.</p>
                  ) : (
                    profitByPackage.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{PACKAGE_LABELS[item.key] ?? item.key}</span>
                        <span className="font-display">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="card-lite rounded-2xl border border-border bg-surface-strong p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  Lucro por tipo de quarto
                </p>
                <div className="mt-2 space-y-2">
                  {profitByRoom.length === 0 ? (
                    <p className="text-sm text-muted">Sem dados por quarto.</p>
                  ) : (
                    profitByRoom.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {ROOM_CATEGORY_LABELS[item.key] ?? item.key}
                        </span>
                        <span className="font-display">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Automacao de gastos"
          description="Faturas lidas por email entram direto no controle."
        >
          <div className="space-y-6">
            <ExpenseIngestForm />
            {invoices.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhuma fatura ingerida. Conecte o email financeiro.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                {invoices.map((invoice) => {
                  const periodLabel =
                    invoice.billingPeriodStart && invoice.billingPeriodEnd
                      ? `${formatDate(invoice.billingPeriodStart)} - ${formatDate(
                          invoice.billingPeriodEnd
                        )}`
                      : null;
                  return (
                    <div
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-3 card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
                    >
                      <div>
                        <p className="font-display text-base text-foreground">
                          {PROVIDER_LABELS[invoice.provider] ?? invoice.provider}
                        </p>
                        <p className="text-xs text-muted">
                          {invoice.invoiceNumber
                            ? `Fatura ${invoice.invoiceNumber}`
                            : "Fatura sem numero"}
                          {" • "}
                          Vencimento: {formatDate(invoice.dueDate)}
                          {periodLabel ? ` • Periodo: ${periodLabel}` : ""}
                        </p>
                      </div>
                      <span className="font-display text-lg">
                        {formatCurrency(Number(invoice.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}

