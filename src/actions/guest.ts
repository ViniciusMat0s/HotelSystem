"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export type GuestActionState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

const OptionalEmail = z.string().email().optional().nullable();
const OptionalText = z.string().optional().nullable();

const GuestCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: OptionalEmail,
  phone: OptionalText,
  documentId: OptionalText,
  nationality: OptionalText,
  marketingOptIn: z.string().optional(),
  profileNote: OptionalText,
  difficultyScore: OptionalText,
});

const GuestUpdateSchema = GuestCreateSchema.extend({
  guestId: z.string().min(1),
});

const normalizeOptional = (value: FormDataEntryValue | null) => {
  if (value === null) return null;
  const trimmed = value.toString().trim();
  return trimmed ? trimmed : null;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseOptionalInt = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const isForeignKeyError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2003";

export async function createGuestAction(
  _prevState: GuestActionState,
  formData: FormData
): Promise<GuestActionState> {
  const payload = GuestCreateSchema.safeParse({
    firstName: formData.get("firstName")?.toString(),
    lastName: formData.get("lastName")?.toString(),
    email: normalizeOptional(formData.get("email")),
    phone: normalizeOptional(formData.get("phone")),
    documentId: normalizeOptional(formData.get("documentId")),
    nationality: normalizeOptional(formData.get("nationality")),
    marketingOptIn: formData.get("marketingOptIn")?.toString(),
    profileNote: normalizeOptional(formData.get("profileNote")),
    difficultyScore: normalizeOptional(formData.get("difficultyScore")),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const difficultyScore = parseOptionalInt(payload.data.difficultyScore);
  if (difficultyScore === undefined) {
    return { status: "error", message: "Score invalido." };
  }
  const score = Math.max(0, Math.min(10, difficultyScore ?? 0));

  const hotel = await ensureDefaultHotel();

  await prisma.guest.create({
    data: {
      hotelId: hotel.id,
      firstName: payload.data.firstName.trim(),
      lastName: payload.data.lastName.trim(),
      email: payload.data.email,
      phone: payload.data.phone,
      documentId: payload.data.documentId,
      nationality: payload.data.nationality,
      marketingOptIn: payload.data.marketingOptIn === "on",
      profileNote: normalizeText(payload.data.profileNote),
      difficultyScore: score,
    },
  });

  revalidatePath("/crm");
  revalidatePath("/");

  return { status: "ok", message: "Hospede criado com sucesso." };
}

export async function updateGuestAction(
  _prevState: GuestActionState,
  formData: FormData
): Promise<GuestActionState> {
  const payload = GuestUpdateSchema.safeParse({
    guestId: formData.get("guestId")?.toString(),
    firstName: formData.get("firstName")?.toString(),
    lastName: formData.get("lastName")?.toString(),
    email: normalizeOptional(formData.get("email")),
    phone: normalizeOptional(formData.get("phone")),
    documentId: normalizeOptional(formData.get("documentId")),
    nationality: normalizeOptional(formData.get("nationality")),
    marketingOptIn: formData.get("marketingOptIn")?.toString(),
    profileNote: normalizeOptional(formData.get("profileNote")),
    difficultyScore: normalizeOptional(formData.get("difficultyScore")),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os dados enviados." };
  }

  const difficultyScore = parseOptionalInt(payload.data.difficultyScore);
  if (difficultyScore === undefined) {
    return { status: "error", message: "Score invalido." };
  }
  const score = Math.max(0, Math.min(10, difficultyScore ?? 0));

  const hotel = await ensureDefaultHotel();
  const guest = await prisma.guest.findFirst({
    where: { id: payload.data.guestId, hotelId: hotel.id },
  });

  if (!guest) {
    return { status: "error", message: "Hospede nao encontrado." };
  }

  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      firstName: payload.data.firstName.trim(),
      lastName: payload.data.lastName.trim(),
      email: payload.data.email,
      phone: payload.data.phone,
      documentId: payload.data.documentId,
      nationality: payload.data.nationality,
      marketingOptIn: payload.data.marketingOptIn === "on",
      profileNote: normalizeText(payload.data.profileNote),
      difficultyScore: score,
    },
  });

  revalidatePath("/crm");
  revalidatePath("/");

  return { status: "ok", message: "Hospede atualizado com sucesso." };
}

export async function deleteGuestAction(
  guestId: string
): Promise<GuestActionState> {
  if (!guestId) {
    return { status: "error", message: "Hospede invalido." };
  }

  const hotel = await ensureDefaultHotel();
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, hotelId: hotel.id },
  });

  if (!guest) {
    return { status: "error", message: "Hospede nao encontrado." };
  }

  try {
    await prisma.guest.delete({ where: { id: guest.id } });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return {
        status: "error",
        message: "Hospede possui reservas. Remova os vinculos antes.",
      };
    }
    return { status: "error", message: "Falha ao excluir hospede." };
  }

  revalidatePath("/crm");
  revalidatePath("/");

  return { status: "ok", message: "Hospede excluido com sucesso." };
}
