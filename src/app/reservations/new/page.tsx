import { Panel } from "@/components/cards";
import { NewReservationForm } from "@/components/new-reservation-form";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export default async function NewReservationPage() {
  const hotel = await ensureDefaultHotel();
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
  const guests = await prisma.guest.findMany({
    where: { hotelId: hotel.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <Panel
        title="Nova reserva"
        description="Registre reservas com confirmacao automatica e chave digital."
      >
        <NewReservationForm rooms={rooms} guests={guests} />
      </Panel>
    </div>
  );
}
