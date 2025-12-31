import { Prisma, ReservationStatus, RoomStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const BLOCKED_ROOM_STATUSES: RoomStatus[] = [
  RoomStatus.MAINTENANCE,
  RoomStatus.OUT_OF_SERVICE,
];

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.CHECKED_IN,
];

type ReassignResult = {
  moved: number;
};

const resolveNote = (note: string | null | undefined) =>
  note ? `${note} | Remanejamento por manutencao.` : "Remanejamento por manutencao.";

export async function reassignReservationsForMaintenanceRoom(
  tx: Prisma.TransactionClient,
  {
    hotelId,
    roomId,
  }: {
    hotelId: string;
    roomId: string;
  }
): Promise<ReassignResult> {
  const room = await tx.room.findFirst({
    where: { id: roomId, hotelId },
    select: { id: true, category: true, maxGuests: true, features: true },
  });

  if (!room) {
    throw new Error("Quarto nao encontrado.");
  }

  const activeReservations = await tx.reservation.findMany({
    where: {
      hotelId,
      roomId,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      checkOut: { gt: new Date() },
    },
    orderBy: { checkIn: "asc" },
  });

  if (activeReservations.length === 0) {
    return { moved: 0 };
  }

  const candidateWhere: Prisma.RoomWhereInput = {
    hotelId,
    id: { not: roomId },
    category: room.category,
    maxGuests: room.maxGuests,
    status: { notIn: BLOCKED_ROOM_STATUSES },
  };

  if (room.features) {
    candidateWhere.features = room.features;
  }

  const candidates = await tx.room.findMany({
    where: candidateWhere,
    orderBy: { number: "asc" },
  });

  if (candidates.length === 0) {
    throw new Error("Nao ha quartos equivalentes disponiveis para remanejamento.");
  }

  let moved = 0;

  for (const reservation of activeReservations) {
    const partySize = reservation.adults + reservation.children;
    let targetRoomId: string | null = null;

    for (const candidate of candidates) {
      if (
        reservation.status === ReservationStatus.CHECKED_IN &&
        candidate.status !== RoomStatus.AVAILABLE
      ) {
        continue;
      }
      if (candidate.maxGuests < partySize) {
        continue;
      }

      const conflicts = await tx.reservation.count({
        where: {
          hotelId,
          roomId: candidate.id,
          status: { in: ACTIVE_RESERVATION_STATUSES },
          checkIn: { lt: reservation.checkOut },
          checkOut: { gt: reservation.checkIn },
        },
      });

      if (conflicts === 0) {
        targetRoomId = candidate.id;
        break;
      }
    }

    if (!targetRoomId) {
      throw new Error(
        "Sem quartos livres para remanejar todas as reservas."
      );
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        roomId: targetRoomId,
        roomCategory: room.category,
      },
    });

    const existingLog = await tx.roomUsageLog.findFirst({
      where: { reservationId: reservation.id },
    });

    if (existingLog) {
      await tx.roomUsageLog.update({
        where: { id: existingLog.id },
        data: {
          roomId: targetRoomId,
          startedAt: reservation.checkIn,
          endedAt: reservation.checkOut,
          note: resolveNote(existingLog.note),
        },
      });
    } else {
      await tx.roomUsageLog.create({
        data: {
          roomId: targetRoomId,
          reservationId: reservation.id,
          startedAt: reservation.checkIn,
          endedAt: reservation.checkOut,
          note: "Remanejamento por manutencao.",
        },
      });
    }

    await tx.digitalKey.updateMany({
      where: { reservationId: reservation.id },
      data: { roomId: targetRoomId },
    });

    if (reservation.status === ReservationStatus.CHECKED_IN) {
      await tx.room.update({
        where: { id: targetRoomId },
        data: { status: RoomStatus.OCCUPIED },
      });
    }

    moved += 1;
  }

  return { moved };
}

export async function reassignReservationsForMaintenanceRoomStandalone({
  hotelId,
  roomId,
}: {
  hotelId: string;
  roomId: string;
}) {
  return prisma.$transaction((tx) =>
    reassignReservationsForMaintenanceRoom(tx, { hotelId, roomId })
  );
}
