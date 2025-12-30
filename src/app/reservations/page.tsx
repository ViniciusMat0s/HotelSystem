import { Panel } from "@/components/cards";
import { ChannelSyncActions } from "@/components/channel-sync";
import { LeadQualifier } from "@/components/lead-qualifier";
import { ReservationsManager } from "@/components/reservations-manager";
import { NotificationStatus, NotificationType } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { getChannelSyncStatus } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

export default async function ReservationsPage() {
  const hotel = await ensureDefaultHotel();
  const channels = await getChannelSyncStatus(hotel.id);
  const confirmations = await prisma.notification.findMany({
    where: {
      hotelId: hotel.id,
      type: NotificationType.CONFIRMATION,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const pendingConfirmations = confirmations.filter(
    (item) => item.status === NotificationStatus.QUEUED
  ).length;

  const reservations = await prisma.reservation.findMany({
    where: { hotelId: hotel.id },
    include: {
      guest: true,
      room: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id },
    select: {
      id: true,
      number: true,
      status: true,
      category: true,
    },
    orderBy: { number: "asc" },
  });

  const reservationItems = reservations.map((reservation) => ({
    id: reservation.id,
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    status: reservation.status,
    paymentStatus: reservation.paymentStatus,
    source: reservation.source,
    roomId: reservation.roomId,
    roomCategory: reservation.roomCategory,
    adults: reservation.adults,
    children: reservation.children,
    totalAmount: reservation.totalAmount ? reservation.totalAmount.toString() : null,
    packageType: reservation.packageType ?? null,
    seasonType: reservation.seasonType ?? null,
    notes: reservation.notes ?? null,
    guest: {
      firstName: reservation.guest.firstName,
      lastName: reservation.guest.lastName,
    },
    room: reservation.room
      ? {
          id: reservation.room.id,
          number: reservation.room.number,
          category: reservation.room.category,
        }
      : null,
  }));

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel
          title="Chatbot IA"
          description="Qualificacao automatica antes de transferir para humano."
        >
          <LeadQualifier />
        </Panel>
        <Panel
          title="Sincronizacao real-time"
          description="Disponibilidade e reservas alinhadas."
        >
          <ChannelSyncActions channels={channels} />
        </Panel>
      </section>

      <Panel
        title="Confirmacoes automaticas"
        description="PDF e regras enviadas apos pagamento."
        action={
          <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs text-secondary">
            {pendingConfirmations} pendentes
          </span>
        }
      >
        {confirmations.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma confirmacao enviada ainda.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {confirmations.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <span>{item.toAddress || "Hospede"}</span>
                <span className="text-xs text-muted">{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Reservas recentes"
        description="Edite, confirme ou cancele reservas rapidamente."
      >
        <ReservationsManager reservations={reservationItems} rooms={rooms} />
      </Panel>
    </div>
  );
}

