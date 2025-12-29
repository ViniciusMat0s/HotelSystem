import { Panel, StatCard, Pill } from "@/components/cards";
import { RoomIssueStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { getMaintenanceSummary } from "@/lib/reports/maintenance";
import { getOccupancyReport } from "@/lib/reports/occupancy";

export default async function RoomsPage() {
  const hotel = await ensureDefaultHotel();
  const occupancy = await getOccupancyReport(hotel.id);
  const maintenance = await getMaintenanceSummary(hotel.id);

  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id },
    include: {
      issues: {
        where: { status: { in: [RoomIssueStatus.OPEN, RoomIssueStatus.IN_PROGRESS] } },
        orderBy: { reportedAt: "desc" },
      },
    },
    orderBy: { number: "asc" },
    take: 12,
  });

  const usageLogs = await prisma.roomUsageLog.findMany({
    where: { room: { hotelId: hotel.id } },
    include: {
      room: true,
      reservation: { include: { guest: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 6,
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-4">
        <StatCard
          label="Ocupados"
          value={`${occupancy.occupied}`}
          hint="Quartos em uso"
          accent="secondary"
        />
        <StatCard
          label="Disponiveis"
          value={`${occupancy.available}`}
          hint="Prontos para check-in"
          accent="accent"
        />
        <StatCard
          label="Manutencao"
          value={`${occupancy.maintenance}`}
          hint="Em reparo"
        />
        <StatCard
          label="Fora de uso"
          value={`${occupancy.outOfService}`}
          hint="Bloqueados"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Livro de reservas"
          description="Status por quarto e alertas de manutencao."
        >
          {rooms.length === 0 ? (
            <p className="text-sm text-muted">
              Cadastre os quartos para acompanhar ocupacao e manutencao.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-2xl border border-border bg-surface-strong p-4 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display text-lg">Quarto {room.number}</p>
                    <Pill>{room.status}</Pill>
                  </div>
                  <p className="mt-2 text-xs text-muted">{room.category}</p>
                  {room.issues.length > 0 ? (
                    <p className="mt-3 text-xs text-primary">
                      {room.issues.length} incidente(s) aberto(s)
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted">Sem incidentes</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title="Recorrencia de problemas"
          description="Quartos com historico de incidentes repetidos."
        >
          {maintenance.recurring.length === 0 ? (
            <p className="text-sm text-muted">
              Ainda sem repeticao de incidentes recentes.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {maintenance.recurring.map((item) => (
                <div
                  key={`${item.roomId}-${item.category}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-strong px-4 py-3"
                >
                  <span>Quarto {item.roomId.slice(0, 4)}</span>
                  <span className="text-muted">
                    {item.category} ({item.count}x)
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel
        title="Historico detalhado"
        description="Ultimos usos registrados por quarto e hospede."
      >
        {usageLogs.length === 0 ? (
          <p className="text-sm text-muted">
            Sem logs de uso ainda. Inicie reservas para gerar historico.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {usageLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <span>
                  Quarto {log.room.number} -{" "}
                  {log.reservation?.guest.firstName ?? "Hospede"}
                </span>
                <span className="text-xs text-muted">
                  {log.startedAt.toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
