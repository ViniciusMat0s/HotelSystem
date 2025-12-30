"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { ingestExpenseInvoiceFromEmail } from "@/lib/automation";

const ExpenseIngestSchema = z.object({
  emailText: z.string().min(10),
});

export type ExpenseIngestState = {
  status: "idle" | "ok" | "error";
  message?: string;
  invoiceId?: string;
  provider?: string;
  amount?: number;
  dueDate?: string;
};

export async function ingestExpenseInvoiceAction(
  _prevState: ExpenseIngestState,
  formData: FormData
): Promise<ExpenseIngestState> {
  const payload = ExpenseIngestSchema.safeParse({
    emailText: formData.get("emailText")?.toString() ?? "",
  });

  if (!payload.success) {
    return { status: "error", message: "Cole o texto completo da fatura." };
  }

  const invoice = await ingestExpenseInvoiceFromEmail(payload.data.emailText);
  if (!invoice) {
    return {
      status: "error",
      message: "Nao foi possivel extrair dados da fatura.",
    };
  }

  revalidatePath("/finance");

  return {
    status: "ok",
    message: "Fatura ingerida com sucesso.",
    invoiceId: invoice.id,
    provider: invoice.provider,
    amount: Number(invoice.amount),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : undefined,
  };
}
