"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  ExpenseProvider,
  FinancialCategory,
  ProfitCenter,
  RecurrenceFrequency,
  SeasonType,
  Prisma,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { processRecurringExpenses } from "@/lib/recurring-expenses";

const RecurringExpenseSchema = z.object({
  name: z.string().min(1),
  provider: z.nativeEnum(ExpenseProvider),
  amount: z.string().min(1),
  currency: z.string().optional(),
  category: z.nativeEnum(FinancialCategory).optional(),
  profitCenter: z.nativeEnum(ProfitCenter).optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  frequency: z.nativeEnum(RecurrenceFrequency).optional(),
  interval: z.string().optional(),
  nextRunAt: z.string().min(1),
  description: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

const RecurringExpenseUpdateSchema = RecurringExpenseSchema.extend({
  recurringExpenseId: z.string().min(1),
});

export type RecurringExpenseActionState = {
  status: "idle" | "ok" | "error";
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

const parseInterval = (value?: string) => {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

export async function createRecurringExpenseAction(
  _prevState: RecurringExpenseActionState,
  formData: FormData
): Promise<RecurringExpenseActionState> {
  const payload = RecurringExpenseSchema.safeParse({
    name: formData.get("name")?.toString(),
    provider: formData.get("provider")?.toString(),
    amount: formData.get("amount")?.toString(),
    currency: cleanOptional(formData.get("currency")),
    category: formData.get("category")?.toString() || undefined,
    profitCenter: formData.get("profitCenter")?.toString() || undefined,
    seasonType: formData.get("seasonType")?.toString() || undefined,
    frequency: formData.get("frequency")?.toString() || undefined,
    interval: cleanOptional(formData.get("interval")),
    nextRunAt: formData.get("nextRunAt")?.toString(),
    description: cleanOptional(formData.get("description")),
    active: formData.get("active")?.toString() === "on",
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const nextRunAt = parseDate(payload.data.nextRunAt);
  if (!nextRunAt) {
    return { status: "error", message: "Data invalida." };
  }

  const amount = parseNumber(payload.data.amount);
  if (amount === null || amount <= 0) {
    return { status: "error", message: "Informe um valor valido." };
  }

  const interval = parseInterval(payload.data.interval);
  const hotel = await ensureDefaultHotel();

  await prisma.recurringExpense.create({
    data: {
      hotelId: hotel.id,
      name: payload.data.name,
      provider: payload.data.provider,
      description: payload.data.description,
      amount: new Prisma.Decimal(amount),
      currency: payload.data.currency ?? "BRL",
      category: payload.data.category ?? FinancialCategory.OTHER,
      profitCenter: payload.data.profitCenter ?? ProfitCenter.OTHER,
      seasonType: payload.data.seasonType ?? undefined,
      frequency: payload.data.frequency ?? RecurrenceFrequency.MONTHLY,
      interval,
      nextRunAt,
      active: payload.data.active ?? true,
    },
  });

  revalidatePath("/finance");
  return { status: "ok", message: "Recorrencia criada com sucesso." };
}

export async function updateRecurringExpenseAction(
  _prevState: RecurringExpenseActionState,
  formData: FormData
): Promise<RecurringExpenseActionState> {
  const payload = RecurringExpenseUpdateSchema.safeParse({
    recurringExpenseId: formData.get("recurringExpenseId")?.toString(),
    name: formData.get("name")?.toString(),
    provider: formData.get("provider")?.toString(),
    amount: formData.get("amount")?.toString(),
    currency: cleanOptional(formData.get("currency")),
    category: formData.get("category")?.toString() || undefined,
    profitCenter: formData.get("profitCenter")?.toString() || undefined,
    seasonType: formData.get("seasonType")?.toString() || undefined,
    frequency: formData.get("frequency")?.toString() || undefined,
    interval: cleanOptional(formData.get("interval")),
    nextRunAt: formData.get("nextRunAt")?.toString(),
    description: cleanOptional(formData.get("description")),
    active: formData.get("active")?.toString() === "on",
  });

  if (!payload.success) {
    return { status: "error", message: "Revise os campos obrigatorios." };
  }

  const nextRunAt = parseDate(payload.data.nextRunAt);
  if (!nextRunAt) {
    return { status: "error", message: "Data invalida." };
  }

  const amount = parseNumber(payload.data.amount);
  if (amount === null || amount <= 0) {
    return { status: "error", message: "Informe um valor valido." };
  }

  const interval = parseInterval(payload.data.interval);
  const hotel = await ensureDefaultHotel();

  const updated = await prisma.recurringExpense.updateMany({
    where: { id: payload.data.recurringExpenseId, hotelId: hotel.id },
    data: {
      name: payload.data.name,
      provider: payload.data.provider,
      description: payload.data.description ?? undefined,
      amount: new Prisma.Decimal(amount),
      currency: payload.data.currency ?? "BRL",
      category: payload.data.category ?? FinancialCategory.OTHER,
      profitCenter: payload.data.profitCenter ?? ProfitCenter.OTHER,
      seasonType: payload.data.seasonType ?? undefined,
      frequency: payload.data.frequency ?? RecurrenceFrequency.MONTHLY,
      interval,
      nextRunAt,
      active: payload.data.active ?? true,
    },
  });

  if (updated.count === 0) {
    return { status: "error", message: "Recorrencia nao encontrada." };
  }

  revalidatePath("/finance");
  return { status: "ok", message: "Recorrencia atualizada com sucesso." };
}

export async function deleteRecurringExpenseAction(
  recurringExpenseId: string
): Promise<RecurringExpenseActionState> {
  if (!recurringExpenseId) {
    return { status: "error", message: "Recorrencia invalida." };
  }

  const hotel = await ensureDefaultHotel();
  const deleted = await prisma.recurringExpense.deleteMany({
    where: { id: recurringExpenseId, hotelId: hotel.id },
  });

  if (deleted.count === 0) {
    return { status: "error", message: "Recorrencia nao encontrada." };
  }

  revalidatePath("/finance");
  return { status: "ok", message: "Recorrencia excluida com sucesso." };
}

export async function runRecurringExpensesAction(): Promise<RecurringExpenseActionState> {
  const result = await processRecurringExpenses();
  revalidatePath("/finance");
  return {
    status: "ok",
    message: `Recorrencias processadas: ${result.processed}. Lancamentos criados: ${result.created}.`,
  };
}
