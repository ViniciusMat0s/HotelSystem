import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PaymentStatus,
  Prisma,
  ReservationSource,
  ReservationStatus,
  RoomCategory,
  SeasonType,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const ReservationSchema = z.object({
  guestId: z.string().min(1),
  roomId: z.string().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
  source: z.nativeEnum(ReservationSource).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  packageType: z.string().optional(),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  adults: z.coerce.number().int().min(1).optional(),
  children: z.coerce.number().int().min(0).optional(),
  totalAmount: z.coerce.number().optional(),
  currency: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const hotel = await ensureDefaultHotel();
  const reservations = await prisma.reservation.findMany({
    where: { hotelId: hotel.id },
    include: { guest: true, room: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reservations);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  if (payload.checkOut <= payload.checkIn) {
    return NextResponse.json(
      { ok: false, message: "checkOut precisa ser maior que checkIn." },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();

  const reservation = await prisma.reservation.create({
    data: {
      hotelId: hotel.id,
      guestId: payload.guestId,
      roomId: payload.roomId,
      status: payload.status ?? ReservationStatus.BOOKED,
      source: payload.source ?? ReservationSource.DIRECT,
      paymentStatus: payload.paymentStatus ?? PaymentStatus.PENDING,
      packageType: payload.packageType,
      roomCategory: payload.roomCategory ?? RoomCategory.STANDARD,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      adults: payload.adults ?? 2,
      children: payload.children ?? 0,
      totalAmount:
        payload.totalAmount !== undefined
          ? new Prisma.Decimal(payload.totalAmount)
          : undefined,
      currency: payload.currency ?? "BRL",
      seasonType: payload.seasonType,
      notes: payload.notes,
    },
  });

  return NextResponse.json({ ok: true, reservation }, { status: 201 });
}
