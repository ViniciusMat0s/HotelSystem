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
import {
  getCategoryAvailability,
  shouldEnforceAvailability,
  validateRoomAvailability,
} from "@/lib/availability";
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
  const status = payload.status ?? ReservationStatus.BOOKED;
  let roomCategory = payload.roomCategory ?? RoomCategory.STANDARD;
  const enforceAvailability = shouldEnforceAvailability(status);

  if (
    (status === ReservationStatus.CHECKED_IN ||
      status === ReservationStatus.CHECKED_OUT) &&
    !payload.roomId
  ) {
    return NextResponse.json(
      { ok: false, message: "Selecione um quarto para check-in ou check-out." },
      { status: 400 }
    );
  }

  if (payload.roomId) {
    const roomCheck = await validateRoomAvailability({
      hotelId: hotel.id,
      roomId: payload.roomId,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      enforceAvailability,
    });
    if (!roomCheck.ok) {
      return NextResponse.json(
        { ok: false, message: roomCheck.message },
        { status: 409 }
      );
    }
    roomCategory = roomCheck.roomCategory ?? roomCategory;
  }

  if (!payload.roomId && enforceAvailability) {
    const availability = await getCategoryAvailability({
      hotelId: hotel.id,
      roomCategory,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
    });
    if (availability.totalRooms === 0) {
      return NextResponse.json(
        { ok: false, message: "Nao existem quartos ativos nessa categoria." },
        { status: 409 }
      );
    }
    if (availability.availableRooms <= 0) {
      return NextResponse.json(
        { ok: false, message: "Sem disponibilidade para a categoria no periodo." },
        { status: 409 }
      );
    }
  }

  const reservation = await prisma.reservation.create({
    data: {
      hotelId: hotel.id,
      guestId: payload.guestId,
      roomId: payload.roomId,
      status,
      source: payload.source ?? ReservationSource.DIRECT,
      paymentStatus: payload.paymentStatus ?? PaymentStatus.PENDING,
      packageType: payload.packageType,
      roomCategory,
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
