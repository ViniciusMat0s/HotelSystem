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
      checkIn: reservation.checkIn.toISOString(),
      checkOut: reservation.checkOut.toISOString(),
      status: reservation.status,
      guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
    })),
  });
}
