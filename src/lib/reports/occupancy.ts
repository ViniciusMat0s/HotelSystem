import { prisma } from "@/lib/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { RoomIssueStatus, RoomStatus } from "@/generated/prisma";

export async function getOccupancyReport(hotelId?: string) {
  const hotel = hotelId
    ? { id: hotelId }
    : await ensureDefaultHotel();

  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id },
    select: { status: true },
  });

  const counts = {
    occupied: 0,
    available: 0,
    maintenance: 0,
    outOfService: 0,
  };

  rooms.forEach((room) => {
    if (room.status === RoomStatus.OCCUPIED) counts.occupied += 1;
    if (room.status === RoomStatus.AVAILABLE) counts.available += 1;
    if (room.status === RoomStatus.MAINTENANCE) counts.maintenance += 1;
    if (room.status === RoomStatus.OUT_OF_SERVICE) counts.outOfService += 1;
  });

  const issues = await prisma.roomIssue.findMany({
    where: {
      room: { hotelId: hotel.id },
      status: { in: [RoomIssueStatus.OPEN, RoomIssueStatus.IN_PROGRESS] },
    },
    select: { roomId: true },
  });

  const roomsWithIssues = new Set(issues.map((issue) => issue.roomId));
  const roomsTotal = rooms.length;
  const occupancyRate = roomsTotal ? counts.occupied / roomsTotal : 0;

  return {
    roomsTotal,
    occupancyRate,
    withIssues: roomsWithIssues.size,
    ...counts,
  };
}
