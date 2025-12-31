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

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId: hotel.id },
  });

  if (!reservation) {
    return NextResponse.json(
      { ok: false, message: "Reservation not found." },
      { status: 404 }
    );
  }

  const nextCheckIn = data.checkIn ?? reservation.checkIn;
  const nextCheckOut = data.checkOut ?? reservation.checkOut;

  if (nextCheckOut <= nextCheckIn) {
    return NextResponse.json(
      { ok: false, message: "checkOut precisa ser maior que checkIn." },
      { status: 400 }
    );
  }

  const nextRoomId =
    data.roomId === null ? null : data.roomId ?? reservation.roomId;
  const nextStatus = data.status ?? reservation.status;
  const nextSource = data.source ?? reservation.source;
  const nextPaymentStatus = data.paymentStatus ?? reservation.paymentStatus;
  const nextRoomCategory = data.roomCategory ?? reservation.roomCategory;
  const enforceAvailability = shouldEnforceAvailability(nextStatus);

  if (
    (nextStatus === ReservationStatus.CHECKED_IN ||
      nextStatus === ReservationStatus.CHECKED_OUT) &&
    !nextRoomId
  ) {
    return NextResponse.json(
      { ok: false, message: "Selecione um quarto para check-in ou check-out." },
      { status: 400 }
    );
  }

  let resolvedRoomCategory = nextRoomCategory;
  if (nextRoomId) {
    const roomCheck = await validateRoomAvailability({
      hotelId: hotel.id,
      roomId: nextRoomId,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
      excludeReservationId: reservation.id,
      enforceAvailability,
    });
    if (!roomCheck.ok) {
      return NextResponse.json(
        { ok: false, message: roomCheck.message },
        { status: 409 }
      );
    }
    resolvedRoomCategory = roomCheck.roomCategory ?? resolvedRoomCategory;
  }

  if (!nextRoomId && enforceAvailability) {
    const availability = await getCategoryAvailability({
      hotelId: hotel.id,
      roomCategory: resolvedRoomCategory,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
      excludeReservationId: reservation.id,
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

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      roomId: nextRoomId,
      status: nextStatus,
      source: nextSource,
      paymentStatus: nextPaymentStatus,
      packageType: data.packageType ?? reservation.packageType,
      roomCategory: resolvedRoomCategory,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
      adults: data.adults ?? reservation.adults,
      children: data.children ?? reservation.children,
      totalAmount:
        data.totalAmount !== undefined
          ? new Prisma.Decimal(data.totalAmount)
          : reservation.totalAmount ?? undefined,
      currency: data.currency ?? reservation.currency,
      seasonType: data.seasonType ?? reservation.seasonType,
      notes: data.notes ?? reservation.notes ?? undefined,
    },
  });

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
