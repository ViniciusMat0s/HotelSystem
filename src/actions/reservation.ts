"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  PaymentStatus,
  Prisma,
  ReservationSource,
  ReservationStatus,
  RoomCategory,
  RoomStatus,
  SeasonType,
  NotificationType,
} from "@/generated/prisma";
import { issueDigitalKey } from "@/lib/access";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { queueConfirmation } from "@/lib/notifications";

const ReservationFormSchema = z.object({
  guestMode: z.enum(["existing", "new"]),
  guestId: z.string().optional(),
  guestFirstName: z.string().optional(),
  guestLastName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  guestDocumentId: z.string().optional(),
  guestNationality: z.string().optional(),
  roomId: z.string().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
  source: z.nativeEnum(ReservationSource).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  packageType: z.string().optional(),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.string().optional(),
  children: z.string().optional(),
  totalAmount: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  notes: z.string().optional(),
});

export type ReservationCreateState = {
  status: "idle" | "error" | "ok";
  message?: string;
  reservationId?: string;
};

export type ReservationActionState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

const cleanOptional = (value: FormDataEntryValue | null) => {
  const trimmed = value?.toString().trim();
  return trimmed ? trimmed : undefined;
};

const parseNumber = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const ReservationUpdateSchema = z.object({
  reservationId: z.string().min(1),
  roomId: z.string().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
  source: z.nativeEnum(ReservationSource).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  packageType: z.string().optional(),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.string().optional(),
  children: z.string().optional(),
  totalAmount: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  notes: z.string().optional(),
});

export async function createReservationAction(
  _prevState: ReservationCreateState,
  formData: FormData
): Promise<ReservationCreateState> {
  const payload = ReservationFormSchema.safeParse({
    guestMode: formData.get("guestMode")?.toString(),
    guestId: cleanOptional(formData.get("guestId")),
    guestFirstName: cleanOptional(formData.get("guestFirstName")),
    guestLastName: cleanOptional(formData.get("guestLastName")),
    guestEmail: cleanOptional(formData.get("guestEmail")),
    guestPhone: cleanOptional(formData.get("guestPhone")),
    guestDocumentId: cleanOptional(formData.get("guestDocumentId")),
    guestNationality: cleanOptional(formData.get("guestNationality")),
    roomId: cleanOptional(formData.get("roomId")),
    status: formData.get("status")?.toString(),
    source: formData.get("source")?.toString(),
    paymentStatus: formData.get("paymentStatus")?.toString(),
    packageType: cleanOptional(formData.get("packageType")),
    roomCategory: formData.get("roomCategory")?.toString() || undefined,
    checkIn: formData.get("checkIn")?.toString(),
    checkOut: formData.get("checkOut")?.toString(),
    adults: cleanOptional(formData.get("adults")),
    children: cleanOptional(formData.get("children")),
    totalAmount: cleanOptional(formData.get("totalAmount")),
    seasonType: formData.get("seasonType")?.toString() || undefined,
    notes: cleanOptional(formData.get("notes")),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const checkIn = parseDate(payload.data.checkIn);
  const checkOut = parseDate(payload.data.checkOut);
  if (!checkIn || !checkOut) {
    return { status: "error", message: "Datas invalidas." };
  }
  if (checkOut <= checkIn) {
    return { status: "error", message: "Check-out deve ser depois do check-in." };
  }

  const hotel = await ensureDefaultHotel();
  const adults = parseNumber(payload.data.adults) ?? 2;
  const children = parseNumber(payload.data.children) ?? 0;
  if (adults < 1 || children < 0) {
    return { status: "error", message: "Quantidade de hospedes invalida." };
  }

  let guestId = payload.data.guestId;
  if (payload.data.guestMode === "existing") {
    if (!guestId) {
      return { status: "error", message: "Selecione um hospede." };
    }
  } else {
    if (!payload.data.guestFirstName || !payload.data.guestLastName) {
      return { status: "error", message: "Informe nome e sobrenome." };
    }
    const guest = await prisma.guest.create({
      data: {
        hotelId: hotel.id,
        firstName: payload.data.guestFirstName,
        lastName: payload.data.guestLastName,
        email: payload.data.guestEmail,
        phone: payload.data.guestPhone,
        documentId: payload.data.guestDocumentId,
        nationality: payload.data.guestNationality,
        marketingOptIn: false,
        difficultyScore: 0,
      },
    });
    guestId = guest.id;
  }

  const status = payload.data.status ?? ReservationStatus.BOOKED;
  const paymentStatus = payload.data.paymentStatus ?? PaymentStatus.PENDING;
  const source = payload.data.source ?? ReservationSource.DIRECT;
  const totalAmount = parseNumber(payload.data.totalAmount ?? undefined);
  const roomId = payload.data.roomId;

  let roomCategory = payload.data.roomCategory ?? RoomCategory.STANDARD;
  if (roomId) {
    const room = await prisma.room.findFirst({
      where: { id: roomId, hotelId: hotel.id },
    });
    if (!room) {
      return { status: "error", message: "Quarto invalido." };
    }
    if ([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE].includes(room.status)) {
      return { status: "error", message: "Quarto indisponivel no momento." };
    }
    const conflicts = await prisma.reservation.count({
      where: {
        hotelId: hotel.id,
        roomId,
        status: {
          in: [
            ReservationStatus.BOOKED,
            ReservationStatus.CHECKED_IN,
          ],
        },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (conflicts > 0) {
      return { status: "error", message: "Quarto ja reservado para o periodo." };
    }
    roomCategory = room.category;
  }

  if (!guestId) {
    return { status: "error", message: "Hospede invalido." };
  }

  const reservation = await prisma.reservation.create({
    data: {
      hotelId: hotel.id,
      guestId,
      roomId,
      status,
      source,
      paymentStatus,
      packageType: payload.data.packageType,
      roomCategory,
      checkIn,
      checkOut,
      adults,
      children,
      totalAmount:
        totalAmount !== null ? new Prisma.Decimal(totalAmount) : undefined,
      currency: "BRL",
      seasonType: payload.data.seasonType,
      notes: payload.data.notes,
    },
  });

  if (roomId) {
    await prisma.roomUsageLog.create({
      data: {
        roomId,
        reservationId: reservation.id,
        startedAt: checkIn,
        endedAt: checkOut,
        note: "Reserva criada manualmente.",
      },
    });

    const nextRoomStatus =
      status === ReservationStatus.CHECKED_IN
        ? RoomStatus.OCCUPIED
        : [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELED, ReservationStatus.NO_SHOW].includes(status)
        ? RoomStatus.AVAILABLE
        : null;

    if (nextRoomStatus) {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: nextRoomStatus },
      });
    }
  }

  let message = "Reserva criada com sucesso.";
  if (paymentStatus === PaymentStatus.PAID) {
    try {
      await queueConfirmation(reservation.id);
      if (roomId) {
        await issueDigitalKey(reservation.id);
      }
      message = roomId
        ? "Reserva criada, confirmacao enviada e chave digital gerada."
        : "Reserva criada e confirmacao enviada.";
    } catch (error) {
      message =
        "Reserva criada, mas houve falha ao enviar confirmacao automatica.";
      console.error("Confirmation/key error:", error);
    }
  }

  revalidatePath("/");
  revalidatePath("/rooms");
  revalidatePath("/reservations");

  return {
    status: "ok",
    message,
    reservationId: reservation.id,
  };
}

export async function updateReservationAction(
  _prevState: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const payload = ReservationUpdateSchema.safeParse({
    reservationId: formData.get("reservationId")?.toString(),
    roomId: formData.get("roomId")?.toString() || undefined,
    status: formData.get("status")?.toString(),
    source: formData.get("source")?.toString(),
    paymentStatus: formData.get("paymentStatus")?.toString(),
    packageType: cleanOptional(formData.get("packageType")),
    roomCategory: formData.get("roomCategory")?.toString() || undefined,
    checkIn: formData.get("checkIn")?.toString(),
    checkOut: formData.get("checkOut")?.toString(),
    adults: cleanOptional(formData.get("adults")),
    children: cleanOptional(formData.get("children")),
    totalAmount: cleanOptional(formData.get("totalAmount")),
    seasonType: formData.get("seasonType")?.toString() || undefined,
    notes: cleanOptional(formData.get("notes")),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os dados enviados." };
  }

  const checkIn = parseDate(payload.data.checkIn);
  const checkOut = parseDate(payload.data.checkOut);
  if (!checkIn || !checkOut) {
    return { status: "error", message: "Datas invalidas." };
  }
  if (checkOut <= checkIn) {
    return { status: "error", message: "Check-out deve ser depois do check-in." };
  }

  const hotel = await ensureDefaultHotel();
  const reservation = await prisma.reservation.findFirst({
    where: { id: payload.data.reservationId, hotelId: hotel.id },
  });
  if (!reservation) {
    return { status: "error", message: "Reserva nao encontrada." };
  }

  const adults = parseNumber(payload.data.adults) ?? reservation.adults ?? 2;
  const children = parseNumber(payload.data.children) ?? reservation.children ?? 0;
  if (adults < 1 || children < 0) {
    return { status: "error", message: "Quantidade de hospedes invalida." };
  }

  const roomIdInput = payload.data.roomId;
  const nextRoomId =
    roomIdInput === "none" ? null : roomIdInput ?? reservation.roomId ?? null;
  const nextStatus = payload.data.status ?? reservation.status;
  const nextPayment = payload.data.paymentStatus ?? reservation.paymentStatus;
  let nextRoomCategory = payload.data.roomCategory ?? reservation.roomCategory;

  if (nextRoomId) {
    const room = await prisma.room.findFirst({
      where: { id: nextRoomId, hotelId: hotel.id },
    });
    if (!room) {
      return { status: "error", message: "Quarto invalido." };
    }
    if ([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE].includes(room.status)) {
      return { status: "error", message: "Quarto indisponivel no momento." };
    }
    nextRoomCategory = room.category;
    const conflicts = await prisma.reservation.count({
      where: {
        id: { not: reservation.id },
        hotelId: hotel.id,
        roomId: nextRoomId,
        status: {
          in: [ReservationStatus.BOOKED, ReservationStatus.CHECKED_IN],
        },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (conflicts > 0) {
      return { status: "error", message: "Quarto ja reservado no periodo." };
    }
  }

  const totalAmount = parseNumber(payload.data.totalAmount ?? undefined);
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      roomId: nextRoomId,
      status: nextStatus,
      source: payload.data.source ?? reservation.source,
      paymentStatus: nextPayment,
      packageType: payload.data.packageType ?? reservation.packageType,
      roomCategory: nextRoomCategory,
      checkIn,
      checkOut,
      adults,
      children,
      totalAmount:
        totalAmount !== null ? new Prisma.Decimal(totalAmount) : undefined,
      seasonType: payload.data.seasonType ?? reservation.seasonType,
      notes: payload.data.notes ?? reservation.notes,
      paidAt:
        nextPayment === PaymentStatus.PAID && reservation.paymentStatus !== PaymentStatus.PAID
          ? new Date()
          : reservation.paidAt,
    },
  });

  if (reservation.roomId && reservation.roomId !== nextRoomId) {
    await prisma.room.update({
      where: { id: reservation.roomId },
      data: { status: RoomStatus.AVAILABLE },
    });
  }

  if (nextRoomId) {
    const existingLog = await prisma.roomUsageLog.findFirst({
      where: { reservationId: reservation.id },
    });
    if (existingLog) {
      await prisma.roomUsageLog.update({
        where: { id: existingLog.id },
        data: {
          roomId: nextRoomId,
          startedAt: checkIn,
          endedAt: checkOut,
        },
      });
    } else {
      await prisma.roomUsageLog.create({
        data: {
          roomId: nextRoomId,
          reservationId: reservation.id,
          startedAt: checkIn,
          endedAt: checkOut,
          note: "Reserva atualizada manualmente.",
        },
      });
    }
  } else {
    await prisma.roomUsageLog.deleteMany({
      where: { reservationId: reservation.id },
    });
  }

  if (nextRoomId) {
    const nextRoomStatus =
      nextStatus === ReservationStatus.CHECKED_IN
        ? RoomStatus.OCCUPIED
        : [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELED, ReservationStatus.NO_SHOW].includes(nextStatus)
        ? RoomStatus.AVAILABLE
        : null;
    if (nextRoomStatus) {
      await prisma.room.update({
        where: { id: nextRoomId },
        data: { status: nextRoomStatus },
      });
    }
  }

  if (
    nextPayment === PaymentStatus.PAID &&
    reservation.paymentStatus !== PaymentStatus.PAID
  ) {
    try {
      const existingConfirmation = await prisma.notification.findFirst({
        where: {
          reservationId: reservation.id,
          type: NotificationType.CONFIRMATION,
        },
      });
      if (!existingConfirmation) {
        await queueConfirmation(reservation.id);
      }
      if (nextRoomId) {
        const existingKey = await prisma.digitalKey.findFirst({
          where: { reservationId: reservation.id },
        });
        if (!existingKey) {
          await issueDigitalKey(reservation.id);
        }
      }
    } catch (error) {
      console.error("Confirmation/key update error:", error);
      return {
        status: "ok",
        message:
          "Reserva atualizada, mas houve falha ao disparar confirmacao automatica.",
      };
    }
  }

  revalidatePath("/rooms");
  revalidatePath("/reservations");

  return {
    status: "ok",
    message: "Reserva atualizada com sucesso.",
  };
}

export async function cancelReservationAction(
  reservationId: string
): Promise<ReservationActionState> {
  if (!reservationId) {
    return { status: "error", message: "Reserva invalida." };
  }

  const hotel = await ensureDefaultHotel();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId: hotel.id },
  });
  if (!reservation) {
    return { status: "error", message: "Reserva nao encontrada." };
  }

  if (reservation.status === ReservationStatus.CANCELED) {
    return { status: "error", message: "Reserva ja cancelada." };
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: ReservationStatus.CANCELED },
  });

  if (reservation.roomId) {
    await prisma.room.update({
      where: { id: reservation.roomId },
      data: { status: RoomStatus.AVAILABLE },
    });
  }

  revalidatePath("/rooms");
  revalidatePath("/reservations");

  return { status: "ok", message: "Reserva cancelada com sucesso." };
}
