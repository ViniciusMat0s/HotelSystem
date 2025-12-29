import { addHours } from "date-fns";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  ReservationStatus,
  NoShowStatus,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function queueConfirmation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, room: true, hotel: true },
  });

  if (!reservation) {
    return null;
  }

  const payload = {
    reservationId: reservation.id,
    guest: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
    room: reservation.room?.number ?? "A definir",
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    rulesUrl: "https://vennity.app/regras",
  };

  return prisma.notification.create({
    data: {
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.CONFIRMATION,
      status: NotificationStatus.QUEUED,
      toAddress: reservation.guest.email ?? "",
      subject: "Confirmacao de reserva",
      payload,
    },
  });
}

export async function evaluateLateArrivals(hotelId: string) {
  const now = new Date();
  const lateWindow = addHours(now, -1);

  const lateReservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      status: ReservationStatus.BOOKED,
      checkIn: { lte: lateWindow },
    },
    include: { guest: true },
  });

  const createdCases = await Promise.all(
    lateReservations.map(async (reservation) => {
      const existing = await prisma.noShowCase.findUnique({
        where: { reservationId: reservation.id },
      });
      if (existing) {
        return null;
      }

      const caseRecord = await prisma.noShowCase.create({
        data: {
          reservationId: reservation.id,
          status: NoShowStatus.PENDING,
        },
      });

      await prisma.notification.create({
        data: {
          hotelId,
          reservationId: reservation.id,
          channel: NotificationChannel.WHATSAPP,
          type: NotificationType.LATE_ARRIVAL,
          status: NotificationStatus.QUEUED,
          toAddress: reservation.guest.phone ?? "",
          subject: "Chegada atrasada",
          payload: {
            reservationId: reservation.id,
            guest: reservation.guest.firstName,
          },
        },
      });

      return caseRecord;
    })
  );

  return createdCases.filter(Boolean).length;
}
