import {
  ReservationStatus,
  RoomCategory,
  RoomStatus,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const BLOCKED_ROOM_STATUSES = [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE];
const BLOCKING_RESERVATION_STATUSES = [
  ReservationStatus.BOOKED,
  ReservationStatus.CHECKED_IN,
];

export const shouldEnforceAvailability = (status: ReservationStatus) =>
  status === ReservationStatus.BOOKED ||
  status === ReservationStatus.CHECKED_IN;

export async function validateRoomAvailability({
  hotelId,
  roomId,
  checkIn,
  checkOut,
  excludeReservationId,
  enforceAvailability = true,
}: {
  hotelId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
  enforceAvailability?: boolean;
}) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
    select: { id: true, status: true, category: true },
  });

  if (!room) {
    return { ok: false as const, message: "Quarto invalido." };
  }

  if (enforceAvailability && BLOCKED_ROOM_STATUSES.includes(room.status)) {
    return {
      ok: false as const,
      message: "Quarto indisponivel por manutencao.",
    };
  }

  if (enforceAvailability) {
    const conflicts = await prisma.reservation.count({
      where: {
        hotelId,
        roomId,
        status: { in: BLOCKING_RESERVATION_STATUSES },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    });

    if (conflicts > 0) {
      return {
        ok: false as const,
        message: "Quarto ja reservado para o periodo.",
      };
    }
  }

  return { ok: true as const, roomCategory: room.category };
}

export async function getCategoryAvailability({
  hotelId,
  roomCategory,
  checkIn,
  checkOut,
  excludeReservationId,
}: {
  hotelId: string;
  roomCategory: RoomCategory;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
}) {
  const totalRooms = await prisma.room.count({
    where: {
      hotelId,
      category: roomCategory,
      status: { notIn: BLOCKED_ROOM_STATUSES },
    },
  });

  const reservedRooms = await prisma.reservation.count({
    where: {
      hotelId,
      roomCategory,
      status: { in: BLOCKING_RESERVATION_STATUSES },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
  });

  return {
    totalRooms,
    reservedRooms,
    availableRooms: Math.max(0, totalRooms - reservedRooms),
  };
}

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export async function getReservationLedger({
  hotelId,
  startDate,
  endDate,
}: {
  hotelId: string;
  startDate: Date;
  endDate: Date;
}) {
  const rangeStart = normalizeDate(startDate);
  const rangeEnd = addDays(normalizeDate(endDate), 1);

  const [rooms, reservations] = await Promise.all([
    prisma.room.findMany({
      where: { hotelId },
      select: {
        id: true,
        number: true,
        name: true,
        status: true,
        category: true,
      },
      orderBy: { number: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        hotelId,
        roomId: { not: null },
        status: { not: ReservationStatus.CANCELED },
        checkIn: { lt: rangeEnd },
        checkOut: { gt: rangeStart },
      },
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        status: true,
        guest: { select: { firstName: true, lastName: true } },
      },
      orderBy: { checkIn: "asc" },
    }),
  ]);

  return { rooms, reservations };
}
