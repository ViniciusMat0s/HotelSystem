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

const ReservationUpdateSchema = z.object({
  roomId: z.string().optional().nullable(),
  status: z.nativeEnum(ReservationStatus).optional(),
  source: z.nativeEnum(ReservationSource).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  packageType: z.string().optional().nullable(),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  adults: z.coerce.number().int().min(1).optional(),
  children: z.coerce.number().int().min(0).optional(),
  totalAmount: z.coerce.number().optional(),
  currency: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params?: Promise<{ reservationId?: string }> };

const getReservationId = async (context: RouteContext) => {
  const params = await context.params;
  return typeof params?.reservationId === "string" ? params.reservationId : null;
};

export async function GET(_request: Request, context: RouteContext) {
  const reservationId = await getReservationId(context);
  if (!reservationId) {
    return NextResponse.json(
      { ok: false, message: "Invalid reservationId." },
      { status: 400 }
    );
  }
  const hotel = await ensureDefaultHotel();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId: hotel.id },
    include: { guest: true, room: true },
  });

  if (!reservation) {
    return NextResponse.json(
      { ok: false, message: "Reservation not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(reservation);
}

export async function PATCH(request: Request, context: RouteContext) {
  const reservationId = await getReservationId(context);
  if (!reservationId) {
    return NextResponse.json(
      { ok: false, message: "Invalid reservationId." },
      { status: 400 }
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = ReservationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const data = parsed.data;

  if (data.checkIn && data.checkOut && data.checkOut <= data.checkIn) {
    return NextResponse.json(
      { ok: false, message: "checkOut precisa ser maior que checkIn." },
      { status: 400 }
    );
  }

  const updated = await prisma.reservation.updateMany({
    where: { id: reservationId, hotelId: hotel.id },
    data: {
      roomId: data.roomId ?? undefined,
      status: data.status,
      source: data.source,
      paymentStatus: data.paymentStatus,
      packageType: data.packageType ?? undefined,
      roomCategory: data.roomCategory,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: data.adults,
      children: data.children,
      totalAmount:
        data.totalAmount !== undefined
          ? new Prisma.Decimal(data.totalAmount)
          : undefined,
      currency: data.currency,
      seasonType: data.seasonType,
      notes: data.notes ?? undefined,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { ok: false, message: "Reservation not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const reservationId = await getReservationId(context);
  if (!reservationId) {
    return NextResponse.json(
      { ok: false, message: "Invalid reservationId." },
      { status: 400 }
    );
  }
  const hotel = await ensureDefaultHotel();
  const result = await prisma.reservation.deleteMany({
    where: { id: reservationId, hotelId: hotel.id },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { ok: false, message: "Reservation not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
