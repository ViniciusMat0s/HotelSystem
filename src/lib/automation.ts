import { ExpenseProvider, InvoiceStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const PROVIDER_KEYWORDS: Record<string, ExpenseProvider> = {
  agua: ExpenseProvider.WATER,
  agua_sabesp: ExpenseProvider.WATER,
  luz: ExpenseProvider.POWER,
  energia: ExpenseProvider.POWER,
  internet: ExpenseProvider.INTERNET,
  fibra: ExpenseProvider.INTERNET,
  tv: ExpenseProvider.TV,
  cabo: ExpenseProvider.TV,
};

const AMOUNT_REGEX = /(?:R\$|BRL)\s?([0-9.,]+)/i;
const DUE_DATE_REGEX = /vencimento[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i;

const parseAmount = (raw: string) =>
  Number(raw.replace(/\./g, "").replace(",", "."));

export function parseExpenseInvoiceEmail(emailText: string) {
  const lower = emailText.toLowerCase();
  const providerKey = Object.keys(PROVIDER_KEYWORDS).find((key) =>
    lower.includes(key)
  );
  const amountMatch = emailText.match(AMOUNT_REGEX);
  const dueMatch = emailText.match(DUE_DATE_REGEX);

  if (!amountMatch) {
    return null;
  }

  const amount = parseAmount(amountMatch[1]);
  const dueDate = dueMatch
    ? new Date(dueMatch[1].split("/").reverse().join("-"))
    : null;

  return {
    provider: providerKey ? PROVIDER_KEYWORDS[providerKey] : ExpenseProvider.OTHER,
    amount,
    dueDate,
  };
}

export async function ingestExpenseInvoiceFromEmail(emailText: string) {
  const parsed = parseExpenseInvoiceEmail(emailText);
  if (!parsed) {
    return null;
  }

  const hotel = await ensureDefaultHotel();

  return prisma.expenseInvoice.create({
    data: {
      hotelId: hotel.id,
      provider: parsed.provider,
      amount: parsed.amount,
      dueDate: parsed.dueDate ?? undefined,
      status: InvoiceStatus.RECEIVED,
      notes: "Auto-ingest via email",
    },
  });
}
