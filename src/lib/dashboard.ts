import {
  NoShowStatus,
  NotificationStatus,
  ReservationStatus,
  RoomIssueStatus,
  SeasonType,
} from "@/generated/prisma";
import {
  differenceInCalendarDays,
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
import { DEFAULT_HOTEL_SLUG, ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { getOccupancyReport } from "@/lib/reports/occupancy";
import { getProfitBreakdown, getRevenueSummary } from "@/lib/reports/finance";
import { getChannelSyncStatus } from "@/lib/integrations";

export async function getDashboardSnapshot() {
  const hotel = await ensureDefaultHotel();
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [occupancy, financialRevenue, financialProfit, channels, reservations] =
    await Promise.all([
    getOccupancyReport(hotel.id),
    getRevenueSummary(hotel.id),
    getProfitBreakdown(hotel.id),
    getChannelSyncStatus(hotel.id),
    prisma.reservation.findMany({
      where: {
        hotelId: hotel.id,
        checkIn: {
          gte: startMonth,
          lte: endMonth,
        },
      },
      select: {
        checkIn: true,
        checkOut: true,
        status: true,
        totalAmount: true,
        source: true,
        seasonType: true,
        roomCategory: true,
        packageType: true,
        room: { select: { baseRate: true } },
      },
    }),
  ]);

  const estimateReservationAmount = (reservation: (typeof reservations)[number]) => {
    if (reservation.totalAmount) return Number(reservation.totalAmount);
    const baseRate = reservation.room?.baseRate
      ? Number(reservation.room.baseRate)
      : 0;
    if (!baseRate) return 0;
    const nights = Math.max(
      1,
      differenceInCalendarDays(reservation.checkOut, reservation.checkIn)
    );
    return baseRate * nights;
  };

  const monthLabels = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const monthBuckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    return {
      key,
      label: `${monthLabels[month]} ${String(year).slice(-2)}`,
      reservedCount: 0,
      canceledCount: 0,
      totalAmount: 0,
    };
  });

  const monthStats = reservations.reduce<
    Record<
      string,
      {
        reservedCount: number;
        canceledCount: number;
        totalAmount: number;
        totalCount: number;
      }
    >
  >((acc, item) => {
    const date = new Date(item.checkIn);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) {
      acc[key] = { reservedCount: 0, canceledCount: 0, totalAmount: 0, totalCount: 0 };
    }
    if (item.status === ReservationStatus.CANCELED) {
      acc[key].canceledCount += 1;
    } else {
      acc[key].reservedCount += 1;
      const amount = estimateReservationAmount(item);
      if (amount > 0) {
        acc[key].totalAmount += amount;
      }
    }
    acc[key].totalCount += 1;
    return acc;
  }, {});

  const reservationsByMonth = monthBuckets.map((bucket) => ({
    ...bucket,
    reservedCount: monthStats[bucket.key]?.reservedCount ?? 0,
    canceledCount: monthStats[bucket.key]?.canceledCount ?? 0,
    totalAmount: monthStats[bucket.key]?.totalAmount ?? 0,
  }));

  const cancelRateByMonth = monthBuckets.map((bucket) => {
    const stats = monthStats[bucket.key] ?? {
      reservedCount: 0,
      canceledCount: 0,
      totalAmount: 0,
      totalCount: 0,
    };
    const totalCount = stats.totalCount;
    return {
      key: bucket.key,
      label: bucket.label,
      totalCount,
      canceledCount: stats.canceledCount,
      rate: totalCount > 0 ? stats.canceledCount / totalCount : 0,
    };
  });

  const sourceStats = reservations.reduce<
    Record<string, { count: number; canceledCount: number }>
  >((acc, item) => {
    const key = item.source;
    if (!acc[key]) {
      acc[key] = { count: 0, canceledCount: 0 };
    }
    acc[key].count += 1;
    if (item.status === ReservationStatus.CANCELED) {
      acc[key].canceledCount += 1;
    }
    return acc;
  }, {});

  const reservationsBySource = Object.entries(sourceStats)
    .map(([source, data]) => ({
      source,
      count: data.count,
      canceledCount: data.canceledCount,
      rate: data.count > 0 ? data.canceledCount / data.count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const reservationRevenue = Object.entries({
    day: [startOfDay(now), endOfDay(now)],
    week: [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })],
    month: [startOfMonth(now), endOfMonth(now)],
    quarter: [startOfQuarter(now), endOfQuarter(now)],
    year: [startOfYear(now), endOfYear(now)],
  }).reduce<Record<string, { total: number; highSeason: number; lowSeason: number }>>(
    (acc, [key, range]) => {
      const [start, end] = range;
      const summary = reservations.reduce(
        (totals, reservation) => {
          if (reservation.status === ReservationStatus.CANCELED) return totals;
          if (reservation.checkIn < start || reservation.checkIn > end) {
            return totals;
          }
          const amount = estimateReservationAmount(reservation);
          if (amount <= 0) return totals;
          totals.total += amount;
          if (reservation.seasonType === SeasonType.HIGH) {
            totals.highSeason += amount;
          }
          if (reservation.seasonType === SeasonType.LOW) {
            totals.lowSeason += amount;
          }
          return totals;
        },
        { total: 0, highSeason: 0, lowSeason: 0 }
      );
      acc[key] = summary;
      return acc;
    },
    {}
  );

  const reservationProfit = reservations.reduce<{
    byCenter: Record<string, number>;
    byRoom: Record<string, number>;
    byPackage: Record<string, number>;
  }>(
    (acc, reservation) => {
      if (reservation.status === ReservationStatus.CANCELED) return acc;
      const amount = estimateReservationAmount(reservation);
      if (amount <= 0) return acc;
      const centerKey = reservation.packageType ? "PACKAGE" : "ROOM";
      acc.byCenter[centerKey] = (acc.byCenter[centerKey] ?? 0) + amount;
      const roomKey = reservation.roomCategory ?? "OTHER";
      acc.byRoom[roomKey] = (acc.byRoom[roomKey] ?? 0) + amount;
      if (reservation.packageType) {
        const packageKey = reservation.packageType || "PADRAO";
        acc.byPackage[packageKey] = (acc.byPackage[packageKey] ?? 0) + amount;
      }
      return acc;
    },
    { byCenter: {}, byRoom: {}, byPackage: {} }
  );

  const reservationProfitBreakdown = {
    byCenter: Object.entries(reservationProfit.byCenter)
      .map(([key, total]) => ({ key, total }))
      .sort((a, b) => b.total - a.total),
    byRoom: Object.entries(reservationProfit.byRoom)
      .map(([key, total]) => ({ key, total }))
      .sort((a, b) => b.total - a.total),
    byPackage: Object.entries(reservationProfit.byPackage)
      .map(([key, total]) => ({ key, total }))
      .sort((a, b) => b.total - a.total),
  };

  const useReservationData = hotel.slug === DEFAULT_HOTEL_SLUG;
  const revenue = useReservationData ? reservationRevenue : financialRevenue;
  const profit = useReservationData ? reservationProfitBreakdown : financialProfit;

  const openMaintenance = await prisma.roomIssue.count({
    where: {
      room: { hotelId: hotel.id },
      status: { in: [RoomIssueStatus.OPEN, RoomIssueStatus.IN_PROGRESS] },
    },
  });

  const pendingNoShow = await prisma.noShowCase.count({
    where: {
      reservation: { hotelId: hotel.id },
      status: NoShowStatus.PENDING,
    },
  });

  const pendingNotifications = await prisma.notification.count({
    where: { hotelId: hotel.id, status: NotificationStatus.QUEUED },
  });

  return {
    hotel,
    occupancy,
    revenue,
    profit,
    channels,
    reservationsByMonth,
    reservationsBySource,
    cancelRateByMonth,
    alerts: {
      openMaintenance,
      pendingNoShow,
      pendingNotifications,
    },
  };
}
