import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  FinancialEntryType,
  ProfitCenter,
  SeasonType,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";

const toNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value ?? 0);

const sumRevenue = async ({
  hotelId,
  start,
  end,
  seasonType,
}: {
  hotelId: string;
  start: Date;
  end: Date;
  seasonType?: SeasonType;
}) => {
  const result = await prisma.financialEntry.aggregate({
    where: {
      hotelId,
      type: FinancialEntryType.REVENUE,
      occurredAt: { gte: start, lte: end },
      ...(seasonType ? { seasonType } : {}),
    },
    _sum: { netAmount: true },
  });

  return toNumber(result._sum.netAmount);
};

export async function getRevenueSummary(hotelId?: string, asOf = new Date()) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();

  const ranges = {
    day: [startOfDay(asOf), endOfDay(asOf)],
    week: [startOfWeek(asOf, { weekStartsOn: 1 }), endOfWeek(asOf, { weekStartsOn: 1 })],
    month: [startOfMonth(asOf), endOfMonth(asOf)],
    quarter: [startOfQuarter(asOf), endOfQuarter(asOf)],
    year: [startOfYear(asOf), endOfYear(asOf)],
  } as const;

  const summary = await Promise.all(
    Object.entries(ranges).map(async ([key, [start, end]]) => {
      const total = await sumRevenue({ hotelId: hotel.id, start, end });
      const highSeason = await sumRevenue({
        hotelId: hotel.id,
        start,
        end,
        seasonType: SeasonType.HIGH,
      });
      const lowSeason = await sumRevenue({
        hotelId: hotel.id,
        start,
        end,
        seasonType: SeasonType.LOW,
      });
      return { key, total, highSeason, lowSeason };
    })
  );

  return summary.reduce<Record<string, { total: number; highSeason: number; lowSeason: number }>>(
    (acc, item) => {
      acc[item.key] = {
        total: item.total,
        highSeason: item.highSeason,
        lowSeason: item.lowSeason,
      };
      return acc;
    },
    {}
  );
}

export async function getProfitBreakdown(hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();

  const byCenter = await prisma.financialEntry.groupBy({
    by: ["profitCenter"],
    where: {
      hotelId: hotel.id,
      type: FinancialEntryType.REVENUE,
    },
    _sum: { netAmount: true },
  });

  const byRoom = await prisma.financialEntry.groupBy({
    by: ["roomCategory"],
    where: {
      hotelId: hotel.id,
      type: FinancialEntryType.REVENUE,
      profitCenter: ProfitCenter.ROOM,
    },
    _sum: { netAmount: true },
  });

  const byPackage = await prisma.financialEntry.groupBy({
    by: ["packageType"],
    where: {
      hotelId: hotel.id,
      type: FinancialEntryType.REVENUE,
      profitCenter: ProfitCenter.PACKAGE,
    },
    _sum: { netAmount: true },
  });

  return {
    byCenter: byCenter.map((item) => ({
      key: item.profitCenter,
      total: toNumber(item._sum.netAmount),
    })),
    byRoom: byRoom.map((item) => ({
      key: item.roomCategory ?? "OUTROS",
      total: toNumber(item._sum.netAmount),
    })),
    byPackage: byPackage.map((item) => ({
      key: item.packageType ?? "PADRAO",
      total: toNumber(item._sum.netAmount),
    })),
  };
}
