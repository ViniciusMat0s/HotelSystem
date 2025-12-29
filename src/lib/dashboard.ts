import {
  NotificationStatus,
  NoShowStatus,
  RoomIssueStatus,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { getOccupancyReport } from "@/lib/reports/occupancy";
import { getProfitBreakdown, getRevenueSummary } from "@/lib/reports/finance";
import { getChannelSyncStatus } from "@/lib/integrations";

export async function getDashboardSnapshot() {
  const hotel = await ensureDefaultHotel();

  const [occupancy, revenue, profit, channels] = await Promise.all([
    getOccupancyReport(hotel.id),
    getRevenueSummary(hotel.id),
    getProfitBreakdown(hotel.id),
    getChannelSyncStatus(hotel.id),
  ]);

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
    alerts: {
      openMaintenance,
      pendingNoShow,
      pendingNotifications,
    },
  };
}
