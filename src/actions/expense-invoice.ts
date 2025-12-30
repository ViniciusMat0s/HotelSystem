"use server";

import { revalidatePath } from "next/cache";
import {
  ExpenseProvider,
  FinancialCategory,
  FinancialEntryType,
  FinancialSource,
  InvoiceStatus,
  Prisma,
  ProfitCenter,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export type ExpenseInvoiceActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

const PROVIDER_LABELS: Record<ExpenseProvider, string> = {
  WATER: "Agua",
  POWER: "Energia",
  INTERNET: "Internet",
  TV: "TV",
  OTHER: "Outros",
};

const createAudit = async ({
  invoiceId,
  action,
  fromStatus,
  toStatus,
  note,
  actor = "manual",
}: {
  invoiceId: string;
  action: string;
  fromStatus?: InvoiceStatus | null;
  toStatus?: InvoiceStatus | null;
  note?: string | null;
  actor?: string;
}) => {
  await prisma.expenseInvoiceAudit.create({
    data: {
      invoiceId,
      action,
      fromStatus: fromStatus ?? undefined,
      toStatus: toStatus ?? undefined,
      note: note ?? undefined,
      actor,
    },
  });
};

const upsertExpenseEntry = async (invoice: {
  id: string;
  hotelId: string;
  provider: ExpenseProvider;
  invoiceNumber: string | null;
  amount: Prisma.Decimal;
  currency: string;
  paidAt: Date | null;
  description: string | null;
}) => {
  const occurredAt = invoice.paidAt ?? new Date();
  const description =
    invoice.description ??
    `Fatura ${invoice.invoiceNumber ?? PROVIDER_LABELS[invoice.provider]}`;

  const existing = await prisma.financialEntry.findFirst({
    where: { expenseInvoiceId: invoice.id },
  });

  const data = {
    hotelId: invoice.hotelId,
    expenseInvoiceId: invoice.id,
    occurredAt,
    type: FinancialEntryType.EXPENSE,
    category: FinancialCategory.OTHER,
    profitCenter: ProfitCenter.OTHER,
    description,
    grossAmount: invoice.amount,
    netAmount: invoice.amount,
    currency: invoice.currency,
    source: FinancialSource.INVOICE,
  };

  if (existing) {
    await prisma.financialEntry.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.financialEntry.create({ data });
};

export async function approveExpenseInvoiceAction(
  invoiceId: string
): Promise<ExpenseInvoiceActionState> {
  if (!invoiceId) {
    return { status: "error", message: "Fatura invalida." };
  }

  const hotel = await ensureDefaultHotel();
  const invoice = await prisma.expenseInvoice.findFirst({
    where: { id: invoiceId, hotelId: hotel.id },
  });

  if (!invoice) {
    return { status: "error", message: "Fatura nao encontrada." };
  }

  if (invoice.status === InvoiceStatus.PAID) {
    return { status: "error", message: "Fatura ja paga." };
  }

  if (invoice.status === InvoiceStatus.CANCELED) {
    return { status: "error", message: "Fatura cancelada." };
  }

  if (invoice.status === InvoiceStatus.APPROVED) {
    return { status: "error", message: "Fatura ja aprovada." };
  }

  await prisma.expenseInvoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  await createAudit({
    invoiceId: invoice.id,
    action: "APPROVED",
    fromStatus: invoice.status,
    toStatus: InvoiceStatus.APPROVED,
  });

  revalidatePath("/finance");
  return { status: "ok", message: "Fatura aprovada." };
}

export async function markExpenseInvoicePaidAction(
  invoiceId: string
): Promise<ExpenseInvoiceActionState> {
  if (!invoiceId) {
    return { status: "error", message: "Fatura invalida." };
  }

  const hotel = await ensureDefaultHotel();
  const invoice = await prisma.expenseInvoice.findFirst({
    where: { id: invoiceId, hotelId: hotel.id },
  });

  if (!invoice) {
    return { status: "error", message: "Fatura nao encontrada." };
  }

  if (invoice.status === InvoiceStatus.CANCELED) {
    return { status: "error", message: "Fatura cancelada." };
  }

  if (invoice.status === InvoiceStatus.PAID) {
    return { status: "error", message: "Fatura ja paga." };
  }

  const paidAt = new Date();

  await prisma.expenseInvoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.PAID,
      approvedAt: invoice.approvedAt ?? paidAt,
      paidAt,
    },
  });

  await upsertExpenseEntry({
    id: invoice.id,
    hotelId: invoice.hotelId,
    provider: invoice.provider,
    invoiceNumber: invoice.invoiceNumber ?? null,
    amount: invoice.amount,
    currency: invoice.currency,
    paidAt,
    description: invoice.notes,
  });

  await createAudit({
    invoiceId: invoice.id,
    action: "PAID",
    fromStatus: invoice.status,
    toStatus: InvoiceStatus.PAID,
  });

  revalidatePath("/finance");
  return { status: "ok", message: "Fatura marcada como paga." };
}

export async function cancelExpenseInvoiceAction(
  invoiceId: string
): Promise<ExpenseInvoiceActionState> {
  if (!invoiceId) {
    return { status: "error", message: "Fatura invalida." };
  }

  const hotel = await ensureDefaultHotel();
  const invoice = await prisma.expenseInvoice.findFirst({
    where: { id: invoiceId, hotelId: hotel.id },
  });

  if (!invoice) {
    return { status: "error", message: "Fatura nao encontrada." };
  }

  if (invoice.status === InvoiceStatus.CANCELED) {
    return { status: "error", message: "Fatura ja cancelada." };
  }

  await prisma.expenseInvoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.CANCELED,
    },
  });

  await createAudit({
    invoiceId: invoice.id,
    action: "CANCELED",
    fromStatus: invoice.status,
    toStatus: InvoiceStatus.CANCELED,
  });

  revalidatePath("/finance");
  return { status: "ok", message: "Fatura cancelada." };
}

export async function updateExpenseInvoiceNotesAction(
  _prevState: ExpenseInvoiceActionState,
  formData: FormData
): Promise<ExpenseInvoiceActionState> {
  const invoiceId = formData.get("invoiceId")?.toString();
  const notes = formData.get("notes")?.toString() ?? "";

  if (!invoiceId) {
    return { status: "error", message: "Fatura invalida." };
  }

  const hotel = await ensureDefaultHotel();
  const invoice = await prisma.expenseInvoice.findFirst({
    where: { id: invoiceId, hotelId: hotel.id },
  });

  if (!invoice) {
    return { status: "error", message: "Fatura nao encontrada." };
  }

  await prisma.expenseInvoice.update({
    where: { id: invoice.id },
    data: {
      notes: notes.trim() ? notes.trim() : null,
    },
  });

  await createAudit({
    invoiceId: invoice.id,
    action: "NOTES_UPDATED",
    fromStatus: invoice.status,
    toStatus: invoice.status,
    note: notes.trim() ? "Notas atualizadas." : "Notas removidas.",
  });

  revalidatePath("/finance");
  return { status: "ok", message: "Notas atualizadas." };
}
