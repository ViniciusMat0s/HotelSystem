import { Panel } from "@/components/cards";
import { formatCurrency } from "@/lib/format";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { getProfitBreakdown, getRevenueSummary } from "@/lib/reports/finance";

export default async function FinancePage() {
  const hotel = await ensureDefaultHotel();
  const revenue = await getRevenueSummary(hotel.id);
  const profit = await getProfitBreakdown(hotel.id);

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
              className="rounded-2xl border border-border bg-surface-strong p-4 text-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {period}
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

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Gestao de lucros"
          description="Consumo, pacotes e tipos de quarto."
        >
          <div className="space-y-4 text-sm">
            {profit.byCenter.length === 0 ? (
              <p className="text-muted">Sem entradas financeiras.</p>
            ) : (
              profit.byCenter.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between"
                >
                  <span className="uppercase text-muted">{item.key}</span>
                  <span className="font-display text-lg">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))
            )}
            <div className="mt-4 rounded-2xl border border-border bg-surface-strong p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Lucro por pacote
              </p>
              <div className="mt-2 space-y-2">
                {profit.byPackage.length === 0 ? (
                  <p className="text-sm text-muted">Sem pacotes registrados.</p>
                ) : (
                  profit.byPackage.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{item.key}</span>
                      <span className="font-display">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Automacao de gastos"
          description="Faturas lidas por email entram direto no controle."
        >
          {invoices.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma fatura ingerida. Conecte o email financeiro.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-strong px-4 py-3"
                >
                  <span>{invoice.provider}</span>
                  <span className="font-display">
                    {formatCurrency(Number(invoice.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
