"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma, RoomCategory, RoomStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { reassignReservationsForMaintenanceRoom } from "@/lib/room-reassignment";

export type RoomActionState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

const RoomCreateSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  floor: z.string().optional(),
  category: z.nativeEnum(RoomCategory).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
  baseRate: z.string().optional(),
  maxGuests: z.string().optional(),
  features: z.string().optional(),
  notes: z.string().optional(),
});

const RoomUpdateSchema = RoomCreateSchema.extend({
  roomId: z.string().min(1),
});

const parseOptionalNumber = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseOptionalInt = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isUniqueError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const isForeignKeyError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2003";

export async function createRoomAction(
  _prevState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const payload = RoomCreateSchema.safeParse({
    number: formData.get("number")?.toString(),
    name: formData.get("name")?.toString(),
    floor: formData.get("floor")?.toString(),
    category: formData.get("category")?.toString(),
    status: formData.get("status")?.toString(),
    baseRate: formData.get("baseRate")?.toString(),
    maxGuests: formData.get("maxGuests")?.toString(),
    features: formData.get("features")?.toString(),
    notes: formData.get("notes")?.toString(),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const floor = parseOptionalInt(payload.data.floor);
  if (floor === undefined) {
    return { status: "error", message: "Andar invalido." };
  }

  const maxGuestsParsed = parseOptionalInt(payload.data.maxGuests);
  if (maxGuestsParsed === undefined) {
    return { status: "error", message: "Maximo de hospedes invalido." };
  }
  const maxGuests = maxGuestsParsed ?? 2;
  if (maxGuests < 1) {
    return { status: "error", message: "Maximo de hospedes invalido." };
  }

  const baseRate = parseOptionalNumber(payload.data.baseRate);
  if (baseRate === undefined) {
    return { status: "error", message: "Valor da diaria invalido." };
  }

  const hotel = await ensureDefaultHotel();

  try {
    await prisma.room.create({
      data: {
        hotelId: hotel.id,
        number: payload.data.number.trim(),
        name: normalizeText(payload.data.name),
        floor,
        category: payload.data.category ?? RoomCategory.STANDARD,
        status: payload.data.status ?? RoomStatus.AVAILABLE,
        baseRate: baseRate !== null ? new Prisma.Decimal(baseRate) : undefined,
        maxGuests,
        features: normalizeText(payload.data.features),
        notes: normalizeText(payload.data.notes),
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      return { status: "error", message: "Numero de quarto ja cadastrado." };
    }
    return { status: "error", message: "Falha ao criar quarto." };
  }

  revalidatePath("/rooms");
  revalidatePath("/");

  return { status: "ok", message: "Quarto criado com sucesso." };
}

export async function updateRoomAction(
  _prevState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  const payload = RoomUpdateSchema.safeParse({
    roomId: formData.get("roomId")?.toString(),
    number: formData.get("number")?.toString(),
    name: formData.get("name")?.toString(),
    floor: formData.get("floor")?.toString(),
    category: formData.get("category")?.toString(),
    status: formData.get("status")?.toString(),
    baseRate: formData.get("baseRate")?.toString(),
    maxGuests: formData.get("maxGuests")?.toString(),
    features: formData.get("features")?.toString(),
    notes: formData.get("notes")?.toString(),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os dados enviados." };
  }

  const floor = parseOptionalInt(payload.data.floor);
  if (floor === undefined) {
    return { status: "error", message: "Andar invalido." };
  }

  const maxGuestsParsed = parseOptionalInt(payload.data.maxGuests);
  if (maxGuestsParsed === undefined) {
    return { status: "error", message: "Maximo de hospedes invalido." };
  }
  const maxGuests = maxGuestsParsed ?? 2;
  if (maxGuests < 1) {
    return { status: "error", message: "Maximo de hospedes invalido." };
  }

  const baseRate = parseOptionalNumber(payload.data.baseRate);
  if (baseRate === undefined) {
    return { status: "error", message: "Valor da diaria invalido." };
  }

  const hotel = await ensureDefaultHotel();
  const room = await prisma.room.findFirst({
    where: { id: payload.data.roomId, hotelId: hotel.id },
  });

  if (!room) {
    return { status: "error", message: "Quarto nao encontrado." };
  }

  const nextStatus = payload.data.status ?? room.status;

  try {
    const moved = await prisma.$transaction(async (tx) => {
      let movedCount = 0;
      if (nextStatus === RoomStatus.MAINTENANCE) {
        const result = await reassignReservationsForMaintenanceRoom(tx, {
          hotelId: hotel.id,
          roomId: room.id,
        });
        movedCount = result.moved;
      }

      await tx.room.update({
        where: { id: room.id },
        data: {
          number: payload.data.number.trim(),
          name: normalizeText(payload.data.name),
          floor,
          category: payload.data.category ?? room.category,
          status: nextStatus,
          baseRate: baseRate === null ? null : new Prisma.Decimal(baseRate),
          maxGuests,
          features: normalizeText(payload.data.features),
          notes: normalizeText(payload.data.notes),
        },
      });

      return movedCount;
    });

    revalidatePath("/rooms");
    revalidatePath("/");

    return moved > 0
      ? {
          status: "ok",
          message: `Quarto atualizado e ${moved} reservas remanejadas.`,
        }
      : { status: "ok", message: "Quarto atualizado com sucesso." };
  } catch (error) {
    if (isUniqueError(error)) {
      return { status: "error", message: "Numero de quarto ja cadastrado." };
    }
    if (error instanceof Error && error.message) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Falha ao atualizar quarto." };
  }
}

export async function deleteRoomAction(
  roomId: string
): Promise<RoomActionState> {
  if (!roomId) {
    return { status: "error", message: "Quarto invalido." };
  }

  const hotel = await ensureDefaultHotel();
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId: hotel.id },
  });

  if (!room) {
    return { status: "error", message: "Quarto nao encontrado." };
  }

  try {
    await prisma.room.delete({ where: { id: room.id } });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return {
        status: "error",
        message: "Quarto possui reservas. Remova os vinculos antes.",
      };
    }
    return { status: "error", message: "Falha ao excluir quarto." };
  }

  revalidatePath("/rooms");
  revalidatePath("/");

  return { status: "ok", message: "Quarto excluido com sucesso." };
}
