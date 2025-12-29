import { randomUUID } from "node:crypto";
import { DigitalKeyStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function issueDigitalKey(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true },
  });

  if (!reservation) {
    return null;
  }

  const keyCode = `VK-${randomUUID().slice(0, 8)}`.toUpperCase();

  return prisma.digitalKey.create({
    data: {
      hotelId: reservation.hotelId,
      reservationId: reservation.id,
      roomId: reservation.roomId ?? undefined,
      keyCode,
      status: DigitalKeyStatus.ACTIVE,
      issuedAt: new Date(),
      expiresAt: reservation.checkOut,
      provider: "LOCK-API",
    },
  });
}
