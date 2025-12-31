"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  PaymentStatus,
  FinancialCategory,
  FinancialEntryType,
  FinancialSource,
  ProfitCenter,
  Prisma,
  ReservationSource,
  ReservationStatus,
  RoomCategory,
  RoomStatus,
  SeasonType,
  NotificationType,
} from "@/generated/prisma";
import { issueDigitalKey } from "@/lib/access";
import {
  getCategoryAvailability,
  shouldEnforceAvailability,
  validateRoomAvailability,
} from "@/lib/availability";
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

const SwapReservationSchema = z.object({
  reservationId: z.string().min(1),
  targetReservationId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
});

const BLOCKED_ROOM_STATUSES: RoomStatus[] = [
  RoomStatus.MAINTENANCE,
  RoomStatus.OUT_OF_SERVICE,
];

const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.CHECKED_IN,
];

const SWAP_ALLOWED_STATUSES: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.CHECKED_IN,
];

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

const upsertReservationRevenueEntry = async ({
  hotelId,
  reservationId,
  amount,
  roomCategory,
  packageType,
  seasonType,
  occurredAt,
}: {
  hotelId: string;
  reservationId: string;
  amount: number | null;
  roomCategory: RoomCategory;
  packageType?: string;
  seasonType?: SeasonType | null;
  occurredAt: Date;
}) => {
  if (!amount || amount <= 0) return;

  const profitCenter = packageType ? ProfitCenter.PACKAGE : ProfitCenter.ROOM;
  const category = packageType ? FinancialCategory.PACKAGE : FinancialCategory.ROOM;

  const existing = await prisma.financialEntry.findFirst({
    where: {
      hotelId,
      reservationId,
      type: FinancialEntryType.REVENUE,
    },
  });

  const data = {
    occurredAt,
    type: FinancialEntryType.REVENUE,
    category,
    profitCenter,
    roomCategory,
    packageType: packageType ?? undefined,
    grossAmount: new Prisma.Decimal(amount),
    netAmount: new Prisma.Decimal(amount),
    source: FinancialSource.RESERVATION,
    seasonType: seasonType ?? undefined,
  };

  if (existing) {
    await prisma.financialEntry.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.financialEntry.create({
    data: {
      hotelId,
      reservationId,
      ...data,
    },
  });
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
  const paidAt = paymentStatus === PaymentStatus.PAID ? new Date() : undefined;
  const enforceAvailability = shouldEnforceAvailability(status);

  let roomCategory = payload.data.roomCategory ?? RoomCategory.STANDARD;
  if (roomId) {
    const roomCheck = await validateRoomAvailability({
      hotelId: hotel.id,
      roomId,
      checkIn,
      checkOut,
      enforceAvailability,
    });
    if (!roomCheck.ok) {
      return { status: "error", message: roomCheck.message };
    }
    roomCategory = roomCheck.roomCategory ?? roomCategory;
  }

  if (
    (status === ReservationStatus.CHECKED_IN ||
      status === ReservationStatus.CHECKED_OUT) &&
    !roomId
  ) {
    return {
      status: "error",
      message: "Selecione um quarto para check-in ou check-out.",
    };
  }

  if (!roomId && enforceAvailability) {
    const availability = await getCategoryAvailability({
      hotelId: hotel.id,
      roomCategory,
      checkIn,
      checkOut,
    });
    if (availability.totalRooms === 0) {
      return {
        status: "error",
        message: "Nao existem quartos ativos nessa categoria.",
      };
    }
    if (availability.availableRooms <= 0) {
      return {
        status: "error",
        message: "Sem disponibilidade para a categoria no periodo.",
      };
    }
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
      paidAt,
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
        : status === ReservationStatus.CHECKED_OUT ||
          status === ReservationStatus.CANCELED ||
          status === ReservationStatus.NO_SHOW
        ? RoomStatus.AVAILABLE
        : null;

    if (nextRoomStatus) {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: nextRoomStatus },
      });
    }
  }

  if (paymentStatus === PaymentStatus.PAID) {
    await upsertReservationRevenueEntry({
      hotelId: hotel.id,
      reservationId: reservation.id,
      amount: totalAmount,
      roomCategory,
      packageType: payload.data.packageType,
      seasonType: payload.data.seasonType ?? undefined,
      occurredAt: paidAt ?? new Date(),
    });
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
  revalidatePath("/finance");

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
  const enforceAvailability = shouldEnforceAvailability(nextStatus);
  const paidAt =
    nextPayment === PaymentStatus.PAID &&
    reservation.paymentStatus !== PaymentStatus.PAID
      ? new Date()
      : reservation.paidAt;

  if (nextRoomId) {
    const roomCheck = await validateRoomAvailability({
      hotelId: hotel.id,
      roomId: nextRoomId,
      checkIn,
      checkOut,
      excludeReservationId: reservation.id,
      enforceAvailability,
    });
    if (!roomCheck.ok) {
      return { status: "error", message: roomCheck.message };
    }
    nextRoomCategory = roomCheck.roomCategory ?? nextRoomCategory;
  }

  if (
    (nextStatus === ReservationStatus.CHECKED_IN ||
      nextStatus === ReservationStatus.CHECKED_OUT) &&
    !nextRoomId
  ) {
    return {
      status: "error",
      message: "Selecione um quarto para check-in ou check-out.",
    };
  }

  if (!nextRoomId && enforceAvailability) {
    const availability = await getCategoryAvailability({
      hotelId: hotel.id,
      roomCategory: nextRoomCategory,
      checkIn,
      checkOut,
      excludeReservationId: reservation.id,
    });
    if (availability.totalRooms === 0) {
      return {
        status: "error",
        message: "Nao existem quartos ativos nessa categoria.",
      };
    }
    if (availability.availableRooms <= 0) {
      return { status: "error", message: "Sem disponibilidade no periodo." };
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
      paidAt,
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
        : nextStatus === ReservationStatus.CHECKED_OUT ||
          nextStatus === ReservationStatus.CANCELED ||
          nextStatus === ReservationStatus.NO_SHOW
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
    await upsertReservationRevenueEntry({
      hotelId: hotel.id,
      reservationId: reservation.id,
      amount: totalAmount ?? Number(reservation.totalAmount ?? 0),
      roomCategory: nextRoomCategory,
      packageType: payload.data.packageType ?? reservation.packageType ?? undefined,
      seasonType: payload.data.seasonType ?? reservation.seasonType ?? undefined,
      occurredAt: paidAt ?? new Date(),
    });

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
  revalidatePath("/finance");

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

const resolveRoomStatusAfterSwap = (
  incoming: ReservationStatus,
  outgoing: ReservationStatus
) => {
  if (incoming === ReservationStatus.CHECKED_IN) {
    return RoomStatus.OCCUPIED;
  }
  if (
    incoming === ReservationStatus.CHECKED_OUT ||
    incoming === ReservationStatus.CANCELED ||
    incoming === ReservationStatus.NO_SHOW
  ) {
    return RoomStatus.AVAILABLE;
  }
  if (outgoing === ReservationStatus.CHECKED_IN) {
    return RoomStatus.AVAILABLE;
  }
  return null;
};

export async function swapReservationAction(
  _prevState: ReservationActionState,
  formData: FormData
): Promise<ReservationActionState> {
  const payload = SwapReservationSchema.safeParse({
    reservationId: formData.get("reservationId")?.toString(),
    targetReservationId: formData.get("targetReservationId")?.toString(),
    checkIn: formData.get("checkIn")?.toString(),
    checkOut: formData.get("checkOut")?.toString(),
  });

  if (!payload.success) {
    return { status: "error", message: "Dados invalidos para troca." };
  }

  if (payload.data.reservationId === payload.data.targetReservationId) {
    return { status: "error", message: "Reservas identicas." };
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

  try {
    await prisma.$transaction(async (tx) => {
      const reservations = await tx.reservation.findMany({
        where: {
          id: { in: [payload.data.reservationId, payload.data.targetReservationId] },
          hotelId: hotel.id,
        },
      });

      if (reservations.length !== 2) {
        throw new Error("Reserva nao encontrada.");
      }

      const primary =
        reservations.find(
          (reservation) => reservation.id === payload.data.reservationId
        ) ?? reservations[0];
      const target =
        reservations.find(
          (reservation) => reservation.id === payload.data.targetReservationId
        ) ?? reservations[1];

      if (!primary.roomId || !target.roomId) {
        throw new Error("Reserva sem quarto alocado.");
      }

      if (
        !SWAP_ALLOWED_STATUSES.includes(primary.status) ||
        !SWAP_ALLOWED_STATUSES.includes(target.status)
      ) {
        throw new Error("Apenas reservas ativas podem ser trocadas.");
      }

      const rooms = await tx.room.findMany({
        where: { id: { in: [primary.roomId, target.roomId] }, hotelId: hotel.id },
        select: { id: true, status: true, category: true },
      });

      const primaryRoom = rooms.find((room) => room.id === primary.roomId);
      const targetRoom = rooms.find((room) => room.id === target.roomId);

      if (!primaryRoom || !targetRoom) {
        throw new Error("Quarto nao encontrado.");
      }

      const enforcePrimary = shouldEnforceAvailability(primary.status);
      const enforceTarget = shouldEnforceAvailability(target.status);
      const sameRoom = primary.roomId === target.roomId;
      const nextPrimaryRoom = sameRoom ? primaryRoom : targetRoom;
      const nextTargetRoom = sameRoom ? targetRoom : primaryRoom;
      const nextPrimaryCheckIn = sameRoom ? target.checkIn : checkIn;
      const nextPrimaryCheckOut = sameRoom ? target.checkOut : checkOut;
      const nextTargetCheckIn = sameRoom ? primary.checkIn : target.checkIn;
      const nextTargetCheckOut = sameRoom ? primary.checkOut : target.checkOut;

      if (sameRoom) {
        if (
          (enforcePrimary || enforceTarget) &&
          BLOCKED_ROOM_STATUSES.includes(primaryRoom.status)
        ) {
          throw new Error("Quarto indisponivel por manutencao.");
        }
      } else {
        if (
          enforcePrimary &&
          BLOCKED_ROOM_STATUSES.includes(targetRoom.status)
        ) {
          throw new Error("Quarto destino indisponivel por manutencao.");
        }
        if (
          enforceTarget &&
          BLOCKED_ROOM_STATUSES.includes(primaryRoom.status)
        ) {
          throw new Error("Quarto original indisponivel por manutencao.");
        }
      }

      const countConflicts = async (roomId: string, from: Date, to: Date) =>
        tx.reservation.count({
          where: {
            hotelId: hotel.id,
            roomId,
            status: { in: BLOCKING_RESERVATION_STATUSES },
            checkIn: { lt: to },
            checkOut: { gt: from },
            id: { notIn: [primary.id, target.id] },
          },
        });

      const conflictsPrimary = await countConflicts(
        nextPrimaryRoom.id,
        nextPrimaryCheckIn,
        nextPrimaryCheckOut
      );

      if (conflictsPrimary > 0) {
        throw new Error("Conflito no quarto destino para o periodo.");
      }

      const conflictsTarget = await countConflicts(
        nextTargetRoom.id,
        nextTargetCheckIn,
        nextTargetCheckOut
      );

      if (conflictsTarget > 0) {
        throw new Error("Conflito no quarto de origem para a troca.");
      }

      await tx.reservation.update({
        where: { id: primary.id },
        data: {
          roomId: nextPrimaryRoom.id,
          roomCategory: nextPrimaryRoom.category,
          checkIn: nextPrimaryCheckIn,
          checkOut: nextPrimaryCheckOut,
        },
      });

      await tx.reservation.update({
        where: { id: target.id },
        data: {
          roomId: nextTargetRoom.id,
          roomCategory: nextTargetRoom.category,
          checkIn: nextTargetCheckIn,
          checkOut: nextTargetCheckOut,
        },
      });

      const primaryLog = await tx.roomUsageLog.findFirst({
        where: { reservationId: primary.id },
      });
      if (primaryLog) {
        await tx.roomUsageLog.update({
          where: { id: primaryLog.id },
          data: {
            roomId: nextPrimaryRoom.id,
            startedAt: nextPrimaryCheckIn,
            endedAt: nextPrimaryCheckOut,
            note: primaryLog.note
              ? `${primaryLog.note} | Troca de reserva.`
              : "Troca de reserva.",
          },
        });
      } else {
        await tx.roomUsageLog.create({
          data: {
            roomId: nextPrimaryRoom.id,
            reservationId: primary.id,
            startedAt: nextPrimaryCheckIn,
            endedAt: nextPrimaryCheckOut,
            note: "Troca de reserva.",
          },
        });
      }

      const targetLog = await tx.roomUsageLog.findFirst({
        where: { reservationId: target.id },
      });
      if (targetLog) {
        await tx.roomUsageLog.update({
          where: { id: targetLog.id },
          data: {
            roomId: nextTargetRoom.id,
            startedAt: nextTargetCheckIn,
            endedAt: nextTargetCheckOut,
            note: targetLog.note
              ? `${targetLog.note} | Troca de reserva.`
              : "Troca de reserva.",
          },
        });
      } else {
        await tx.roomUsageLog.create({
          data: {
            roomId: nextTargetRoom.id,
            reservationId: target.id,
            startedAt: nextTargetCheckIn,
            endedAt: nextTargetCheckOut,
            note: "Troca de reserva.",
          },
        });
      }

      await tx.digitalKey.updateMany({
        where: { reservationId: primary.id },
        data: { roomId: nextPrimaryRoom.id },
      });
      await tx.digitalKey.updateMany({
        where: { reservationId: target.id },
        data: { roomId: nextTargetRoom.id },
      });

      if (!sameRoom) {
        const nextPrimaryRoomStatus = resolveRoomStatusAfterSwap(
          target.status,
          primary.status
        );
        const nextTargetRoomStatus = resolveRoomStatusAfterSwap(
          primary.status,
          target.status
        );

        if (nextPrimaryRoomStatus) {
          await tx.room.update({
            where: { id: primaryRoom.id },
            data: { status: nextPrimaryRoomStatus },
          });
        }
        if (nextTargetRoomStatus) {
          await tx.room.update({
            where: { id: targetRoom.id },
            data: { status: nextTargetRoomStatus },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Falha ao trocar reservas." };
  }

  revalidatePath("/rooms");
  revalidatePath("/reservations");
  revalidatePath("/bookings");
  revalidatePath("/");

  return { status: "ok", message: "Reservas trocadas com sucesso." };
}
