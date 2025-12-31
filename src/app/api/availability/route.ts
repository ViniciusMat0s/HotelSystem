import { NextResponse } from "next/server";
import { ensureDefaultHotel } from "@/lib/hotel";
import { getReservationLedger } from "@/lib/availability";

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const parseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
};

const formatInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const today = normalizeDate(new Date());
  const startDate = parseDate(searchParams.get("start")) ?? today;
  let endDate = parseDate(searchParams.get("end")) ?? addDays(startDate, 13);
  if (endDate < startDate) {
    endDate = startDate;
  }

  const hotel = await ensureDefaultHotel();
  const { rooms, reservations } = await getReservationLedger({
    hotelId: hotel.id,
    startDate,
    endDate,
  });

  return NextResponse.json({
    ok: true,
    start: formatInputDate(startDate),
    end: formatInputDate(endDate),
    rooms,
    reservations: reservations.map((reservation) => ({
      id: reservation.id,
      roomId: reservation.roomId,
      room: reservation.room
        ? {
            number: reservation.room.number,
            name: reservation.room.name,
            category: reservation.room.category,
          }
        : null,
      checkIn: reservation.checkIn.toISOString(),
      checkOut: reservation.checkOut.toISOString(),
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      source: reservation.source,
      roomCategory: reservation.roomCategory,
      adults: reservation.adults,
      children: reservation.children,
      totalAmount: reservation.totalAmount?.toString() ?? null,
      packageType: reservation.packageType,
      seasonType: reservation.seasonType,
      notes: reservation.notes,
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
      guest: {
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        documentId: reservation.guest.documentId,
        nationality: reservation.guest.nationality,
      },
      guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      noShowStatus: reservation.noShowCase?.status ?? null,
    })),
  });
}
