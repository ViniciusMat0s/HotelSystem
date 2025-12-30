import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { RoomIssueStatus } from "@/generated/prisma";

export async function getMaintenanceSummary(hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();
  const since = subDays(new Date(), 120);

  const issues = await prisma.roomIssue.findMany({
    where: { room: { hotelId: hotel.id } },
    include: { room: true },
    orderBy: { reportedAt: "desc" },
    take: 20,
  });

  const recentIssues = await prisma.roomIssue.findMany({
    where: {
      room: { hotelId: hotel.id },
      reportedAt: { gte: since },
    },
    select: { roomId: true, category: true },
  });

  const recurrenceMap = new Map<string, { roomId: string; category: string; count: number }>();
  recentIssues.forEach((issue) => {
    const key = `${issue.roomId}:${issue.category}`;
    const current = recurrenceMap.get(key) ?? {
      roomId: issue.roomId,
      category: issue.category,
      count: 0,
    };
    current.count += 1;
    recurrenceMap.set(key, current);
  });

  const recurring = [...recurrenceMap.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const openIssues = issues.filter(
    (issue) =>
      issue.status === RoomIssueStatus.OPEN ||
      issue.status === RoomIssueStatus.IN_PROGRESS
  );

  const vendors = await prisma.maintenanceVendor.findMany({
    where: { hotelId: hotel.id },
    orderBy: [{ rating: "desc" }, { lastUsedAt: "desc" }],
    take: 5,
  });

  return {
    openIssues,
    recurring,
    vendors,
  };
}
