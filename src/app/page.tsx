import { Panel, Pill, StatCard } from "@/components/cards";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { formatCurrency, formatPercent } from "@/lib/format";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();
  const revenueMonth = snapshot.revenue.month?.total ?? 0;
  const revenueWeek = snapshot.revenue.week?.total ?? 0;
  const revenueDay = snapshot.revenue.day?.total ?? 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel-strong reveal-up rounded-[32px] p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                Painel operacional
              </p>
              <h2 className="font-display text-3xl text-foreground">
                {snapshot.hotel.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                Receita, manutencao e reservas sincronizadas em um unico fluxo.
              </p>
            </div>
            <div className="flex gap-2">
              <Pill tone="positive">Alta temporada</Pill>
              <Pill tone="warning">Chuva moderada</Pill>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Ocupacao"
              value={formatPercent(snapshot.occupancy.occupancyRate)}
              hint={`${snapshot.occupancy.occupied} ocupados / ${snapshot.occupancy.roomsTotal}`}
              accent="secondary"
            />
            <StatCard
              label="Receita hoje"
              value={formatCurrency(revenueDay)}
              hint="Atualizado em tempo real"
              accent="accent"
            />
            <StatCard
              label="Receita semanal"
              value={formatCurrency(revenueWeek)}
              hint="Comparativo 7 dias"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel reveal-up rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Alertas automaticos
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Manutencoes abertas</span>
                <span className="font-display text-lg">
                  {snapshot.alerts.openMaintenance}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Hospedes em atraso</span>
                <span className="font-display text-lg">
                  {snapshot.alerts.pendingNoShow}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Comunicacoes pendentes</span>
                <span className="font-display text-lg">
                  {snapshot.alerts.pendingNotifications}
                </span>
              </div>
            </div>
          </div>
          <div className="panel reveal-up rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Receita mensal
            </p>
            <p className="mt-4 font-display text-3xl text-foreground">
              {formatCurrency(revenueMonth)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Pill tone="positive">
                Alta: {formatCurrency(snapshot.revenue.month?.highSeason ?? 0)}
              </Pill>
              <Pill>
                Baixa: {formatCurrency(snapshot.revenue.month?.lowSeason ?? 0)}
              </Pill>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Lucro por centro"
          description="Consumo x pacote x quarto."
        >
          <div className="space-y-3 text-sm">
            {snapshot.profit.byCenter.length === 0 ? (
              <p className="text-muted">Sem lancamentos ainda.</p>
            ) : (
              snapshot.profit.byCenter.map((item) => (
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
          </div>
        </Panel>
        <Panel
          title="Reservas inteligentes"
          description="Chatbot qualifica e transfere leads quentes."
        >
          <div className="space-y-4 text-sm text-muted">
            <p>
              IA coleta datas, orcamento e canal de origem. Leads qualificados
              seguem direto para o time humano.
            </p>
            <div className="flex items-center justify-between card-lite rounded-2xl border border-border bg-surface-strong p-4">
              <span>Score medio hoje</span>
              <span className="font-display text-2xl text-foreground">78</span>
            </div>
          </div>
        </Panel>
        <Panel
          title="Sync multicanais"
          description="Booking.com e WhatsApp sempre alinhados."
        >
          <div className="space-y-3 text-sm">
            {snapshot.channels.map((channel) => (
              <div
                key={channel.channel}
                className="flex items-center justify-between card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <span>{channel.channel}</span>
                <span className="text-xs text-muted">
                  {channel.lastSyncAt
                    ? new Date(channel.lastSyncAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Nunca"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

