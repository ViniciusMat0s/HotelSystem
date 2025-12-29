import { Panel, Pill } from "@/components/cards";
import { ensureDefaultHotel } from "@/lib/hotel";
import { getMaintenanceSummary } from "@/lib/reports/maintenance";
import { prisma } from "@/lib/prisma";

export default async function MaintenancePage() {
  const hotel = await ensureDefaultHotel();
  const summary = await getMaintenanceSummary(hotel.id);

  const recurringRooms = await prisma.room.findMany({
    where: { hotelId: hotel.id },
    select: { id: true, number: true },
  });

  return (
    <div className="space-y-8">
      <Panel
        title="Relatorio de manutencao"
        description="Incidentes abertos e padroes recorrentes."
      >
        {summary.openIssues.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum incidente aberto no momento.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {summary.openIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <div>
                  <p className="font-display text-base">
                    Quarto {issue.room.number}
                  </p>
                  <p className="text-xs text-muted">{issue.category}</p>
                </div>
                <Pill tone="critical">{issue.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Problemas recorrentes"
          description="Sugestao automatica de profissionais proximos."
        >
          {summary.recurring.length === 0 ? (
            <p className="text-sm text-muted">
              Sem reincidencias criticas nos ultimos 120 dias.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {summary.recurring.map((item) => {
                const roomNumber =
                  recurringRooms.find((room) => room.id === item.roomId)
                    ?.number ?? item.roomId.slice(0, 4);
                return (
                  <div
                    key={`${item.roomId}-${item.category}`}
                    className="flex items-center justify-between rounded-2xl border border-border bg-surface-strong px-4 py-3"
                  >
                    <span>Quarto {roomNumber}</span>
                    <span className="text-muted">
                      {item.category} ({item.count}x)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel
          title="Profissionais sugeridos"
          description="Baseado em categoria e avaliacao local."
        >
          {summary.vendors.length === 0 ? (
            <p className="text-sm text-muted">
              Cadastre fornecedores para recomendar automaticamente.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {summary.vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="rounded-2xl border border-border bg-surface-strong px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base">{vendor.name}</span>
                    <Pill tone="positive">
                      {vendor.rating?.toFixed(1) ?? "4.6"}
                    </Pill>
                  </div>
                  <p className="text-xs text-muted">{vendor.category}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
