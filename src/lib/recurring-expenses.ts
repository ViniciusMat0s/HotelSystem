import { addMonths, addWeeks, addYears } from "date-fns";
import {
  FinancialEntryType,
  FinancialSource,
  RecurrenceFrequency,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const MAX_OCCURRENCES = 24;

const normalizeDate = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);

const nextOccurrence = (
  value: Date,
  frequency: RecurrenceFrequency,
  interval: number
) => {
  const safeInterval = Number.isNaN(interval) || interval < 1 ? 1 : interval;
  if (frequency === RecurrenceFrequency.WEEKLY) {
    return addWeeks(value, safeInterval);
  }
  if (frequency === RecurrenceFrequency.QUARTERLY) {
    return addMonths(value, 3 * safeInterval);
  }
  if (frequency === RecurrenceFrequency.YEARLY) {
    return addYears(value, safeInterval);
  }
  return addMonths(value, safeInterval);
};

export async function processRecurringExpenses(hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();
  const now = new Date();

  const recurring = await prisma.recurringExpense.findMany({
    where: {
      hotelId: hotel.id,
      active: true,
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
  });

  let createdCount = 0;
  let processedCount = 0;

  for (const item of recurring) {
    processedCount += 1;
    let nextRunAt = normalizeDate(item.nextRunAt);
    let lastRunAt = item.lastRunAt ?? null;
    let iterations = 0;

    while (nextRunAt <= now && iterations < MAX_OCCURRENCES) {
      const existing = await prisma.financialEntry.findFirst({
        where: {
          recurringExpenseId: item.id,
          occurredAt: nextRunAt,
          type: FinancialEntryType.EXPENSE,
        },
      });

      if (!existing) {
        await prisma.financialEntry.create({
          data: {
            hotelId: hotel.id,
            recurringExpenseId: item.id,
            occurredAt: nextRunAt,
            type: FinancialEntryType.EXPENSE,
            category: item.category,
            profitCenter: item.profitCenter,
            roomCategory: null,
            packageType: null,
            description: item.description ?? `${item.name} (recorrente)`,
            grossAmount: item.amount,
            netAmount: item.amount,
            currency: item.currency,
            seasonType: item.seasonType ?? undefined,
            source: FinancialSource.INVOICE,
          },
        });
        createdCount += 1;
      }

      lastRunAt = nextRunAt;
      nextRunAt = normalizeDate(
        nextOccurrence(nextRunAt, item.frequency, item.interval)
      );
      iterations += 1;
    }

    if (iterations > 0) {
      await prisma.recurringExpense.update({
        where: { id: item.id },
        data: {
          lastRunAt: lastRunAt ?? undefined,
          nextRunAt,
        },
      });
    }
  }

  return { processed: processedCount, created: createdCount };
}
