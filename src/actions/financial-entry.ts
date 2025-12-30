"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  FinancialCategory,
  FinancialEntryType,
  FinancialSource,
  Prisma,
  ProfitCenter,
  RoomCategory,
  SeasonType,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const FinancialEntrySchema = z.object({
  occurredAt: z.string().min(1),
  type: z.nativeEnum(FinancialEntryType),
  category: z.nativeEnum(FinancialCategory),
  profitCenter: z.nativeEnum(ProfitCenter),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  packageType: z.string().optional(),
  description: z.string().optional(),
  grossAmount: z.string().optional(),
  netAmount: z.string().min(1),
  taxAmount: z.string().optional(),
  currency: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  source: z.nativeEnum(FinancialSource).optional(),
  reservationId: z.string().optional(),
});

const FinancialEntryUpdateSchema = FinancialEntrySchema.extend({
  entryId: z.string().min(1),
});

export type FinancialEntryActionState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

const cleanOptional = (value: FormDataEntryValue | null) => {
  const trimmed = value?.toString().trim();
  return trimmed ? trimmed : undefined;
};

const parseNumber = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function createFinancialEntryAction(
  _prevState: FinancialEntryActionState,
  formData: FormData
): Promise<FinancialEntryActionState> {
  const payload = FinancialEntrySchema.safeParse({
    occurredAt: formData.get("occurredAt")?.toString(),
    type: formData.get("type")?.toString(),
    category: formData.get("category")?.toString(),
    profitCenter: formData.get("profitCenter")?.toString(),
    roomCategory: formData.get("roomCategory")?.toString() || undefined,
    packageType: cleanOptional(formData.get("packageType")),
    description: cleanOptional(formData.get("description")),
    grossAmount: cleanOptional(formData.get("grossAmount")),
    netAmount: cleanOptional(formData.get("netAmount")),
    taxAmount: cleanOptional(formData.get("taxAmount")),
    currency: cleanOptional(formData.get("currency")),
    seasonType: formData.get("seasonType")?.toString() || undefined,
    source: formData.get("source")?.toString() || undefined,
    reservationId: cleanOptional(formData.get("reservationId")),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const occurredAt = parseDate(payload.data.occurredAt);
  if (!occurredAt) {
    return { status: "error", message: "Data invalida." };
  }

  const netAmount = parseNumber(payload.data.netAmount);
  if (netAmount === null) {
    return { status: "error", message: "Informe o valor liquido." };
  }

  const grossAmount = parseNumber(payload.data.grossAmount);
  const taxAmount = parseNumber(payload.data.taxAmount);

  const hotel = await ensureDefaultHotel();

  await prisma.financialEntry.create({
    data: {
      hotelId: hotel.id,
      reservationId: payload.data.reservationId,
      occurredAt,
      type: payload.data.type,
      category: payload.data.category,
      profitCenter: payload.data.profitCenter,
      roomCategory: payload.data.roomCategory ?? undefined,
      packageType: payload.data.packageType,
      description: payload.data.description,
      grossAmount:
        grossAmount !== null ? new Prisma.Decimal(grossAmount) : undefined,
      netAmount: new Prisma.Decimal(netAmount),
      taxAmount: taxAmount !== null ? new Prisma.Decimal(taxAmount) : undefined,
      currency: payload.data.currency ?? "BRL",
      seasonType: payload.data.seasonType ?? undefined,
      source: payload.data.source ?? FinancialSource.MANUAL,
    },
  });

  revalidatePath("/");
  revalidatePath("/finance");

  return { status: "ok", message: "Lancamento criado com sucesso." };
}

export async function updateFinancialEntryAction(
  _prevState: FinancialEntryActionState,
  formData: FormData
): Promise<FinancialEntryActionState> {
  const payload = FinancialEntryUpdateSchema.safeParse({
    entryId: formData.get("entryId")?.toString(),
    occurredAt: formData.get("occurredAt")?.toString(),
    type: formData.get("type")?.toString(),
    category: formData.get("category")?.toString(),
    profitCenter: formData.get("profitCenter")?.toString(),
    roomCategory: formData.get("roomCategory")?.toString() || undefined,
    packageType: cleanOptional(formData.get("packageType")),
    description: cleanOptional(formData.get("description")),
    grossAmount: cleanOptional(formData.get("grossAmount")),
    netAmount: cleanOptional(formData.get("netAmount")),
    taxAmount: cleanOptional(formData.get("taxAmount")),
    currency: cleanOptional(formData.get("currency")),
    seasonType: formData.get("seasonType")?.toString() || undefined,
    source: formData.get("source")?.toString() || undefined,
    reservationId: cleanOptional(formData.get("reservationId")),
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const occurredAt = parseDate(payload.data.occurredAt);
  if (!occurredAt) {
    return { status: "error", message: "Data invalida." };
  }

  const netAmount = parseNumber(payload.data.netAmount);
  if (netAmount === null) {
    return { status: "error", message: "Informe o valor liquido." };
  }

  const grossAmount = parseNumber(payload.data.grossAmount);
  const taxAmount = parseNumber(payload.data.taxAmount);

  const hotel = await ensureDefaultHotel();
  const updated = await prisma.financialEntry.updateMany({
    where: { id: payload.data.entryId, hotelId: hotel.id },
    data: {
      reservationId: payload.data.reservationId ?? undefined,
      occurredAt,
      type: payload.data.type,
      category: payload.data.category,
      profitCenter: payload.data.profitCenter,
      roomCategory: payload.data.roomCategory ?? undefined,
      packageType: payload.data.packageType ?? undefined,
      description: payload.data.description ?? undefined,
      grossAmount:
        grossAmount !== null ? new Prisma.Decimal(grossAmount) : undefined,
      netAmount: new Prisma.Decimal(netAmount),
      taxAmount: taxAmount !== null ? new Prisma.Decimal(taxAmount) : undefined,
      currency: payload.data.currency ?? "BRL",
      seasonType: payload.data.seasonType ?? undefined,
      source: payload.data.source ?? FinancialSource.MANUAL,
    },
  });

  if (updated.count === 0) {
    return { status: "error", message: "Lancamento nao encontrado." };
  }

  revalidatePath("/");
  revalidatePath("/finance");

  return { status: "ok", message: "Lancamento atualizado com sucesso." };
}

export async function deleteFinancialEntryAction(
  entryId: string
): Promise<FinancialEntryActionState> {
  if (!entryId) {
    return { status: "error", message: "Lancamento invalido." };
  }

  const hotel = await ensureDefaultHotel();
  const deleted = await prisma.financialEntry.deleteMany({
    where: { id: entryId, hotelId: hotel.id },
  });

  if (deleted.count === 0) {
    return { status: "error", message: "Lancamento nao encontrado." };
  }

  revalidatePath("/");
  revalidatePath("/finance");

  return { status: "ok", message: "Lancamento excluido com sucesso." };
}
