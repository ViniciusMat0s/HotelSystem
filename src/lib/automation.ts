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
const INVOICE_NUMBER_REGEX = /(fatura|invoice|nota|nf)[^a-z0-9]*([a-z0-9-]{4,})/i;
const PERIOD_RANGE_REGEX =
  /periodo[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*(?:a|ate|-)\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i;
const PERIOD_MONTH_REGEX =
  /(referencia|competencia)[:\s]*([0-9]{2})\/([0-9]{4})/i;

const parseAmount = (raw: string) =>
  Number(raw.replace(/\./g, "").replace(",", "."));

const parseBrDate = (value: string) => {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export function parseExpenseInvoiceEmail(emailText: string) {
  const lower = emailText.toLowerCase();
  const providerKey = Object.keys(PROVIDER_KEYWORDS).find((key) =>
    lower.includes(key)
  );
  const amountMatch = emailText.match(AMOUNT_REGEX);
  const dueMatch = emailText.match(DUE_DATE_REGEX);
  const invoiceMatch = emailText.match(INVOICE_NUMBER_REGEX);
  const periodRangeMatch = emailText.match(PERIOD_RANGE_REGEX);
  const periodMonthMatch = emailText.match(PERIOD_MONTH_REGEX);

  if (!amountMatch) {
    return null;
  }

  const amount = parseAmount(amountMatch[1]);
  const dueDate = dueMatch
    ? parseBrDate(dueMatch[1])
    : null;
  const invoiceNumber = invoiceMatch ? invoiceMatch[2].toUpperCase() : null;

  let billingPeriodStart: Date | null = null;
  let billingPeriodEnd: Date | null = null;
  if (periodRangeMatch) {
    billingPeriodStart = parseBrDate(periodRangeMatch[1]);
    billingPeriodEnd = parseBrDate(periodRangeMatch[2]);
  } else if (periodMonthMatch) {
    const month = Number(periodMonthMatch[2]);
    const year = Number(periodMonthMatch[3]);
    if (month && year) {
      billingPeriodStart = new Date(year, month - 1, 1);
      billingPeriodEnd = new Date(year, month, 0);
    }
  }

  return {
    provider: providerKey ? PROVIDER_KEYWORDS[providerKey] : ExpenseProvider.OTHER,
    amount,
    dueDate,
    invoiceNumber,
    billingPeriodStart,
    billingPeriodEnd,
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
      invoiceNumber: parsed.invoiceNumber ?? undefined,
      amount: parsed.amount,
      dueDate: parsed.dueDate ?? undefined,
      billingPeriodStart: parsed.billingPeriodStart ?? undefined,
      billingPeriodEnd: parsed.billingPeriodEnd ?? undefined,
      status: InvoiceStatus.RECEIVED,
      notes: "Auto-ingest via email",
    },
  });
}
