import {
  NotificationStatus,
  NoShowStatus,
  ReservationStatus,
  RoomIssueStatus,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { getOccupancyReport } from "@/lib/reports/occupancy";
import { getProfitBreakdown, getRevenueSummary } from "@/lib/reports/finance";
import { getChannelSyncStatus } from "@/lib/integrations";

export async function getDashboardSnapshot() {
  const hotel = await ensureDefaultHotel();
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [occupancy, revenue, profit, channels, reservations] = await Promise.all([
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
      select: { checkIn: true, status: true, totalAmount: true },
    }),
  ]);

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
    Record<string, { reservedCount: number; canceledCount: number; totalAmount: number }>
  >((acc, item) => {
    const date = new Date(item.checkIn);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) {
      acc[key] = { reservedCount: 0, canceledCount: 0, totalAmount: 0 };
    }
    if (item.status === ReservationStatus.CANCELED) {
      acc[key].canceledCount += 1;
    } else {
      acc[key].reservedCount += 1;
      if (item.totalAmount) {
        acc[key].totalAmount += Number(item.totalAmount);
      }
    }
    return acc;
  }, {});

  const reservationsByMonth = monthBuckets.map((bucket) => ({
    ...bucket,
    reservedCount: monthStats[bucket.key]?.reservedCount ?? 0,
    canceledCount: monthStats[bucket.key]?.canceledCount ?? 0,
    totalAmount: monthStats[bucket.key]?.totalAmount ?? 0,
  }));

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
    alerts: {
      openMaintenance,
      pendingNoShow,
      pendingNotifications,
    },
  };
}
