import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, RoomCategory, RoomStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";
import { reassignReservationsForMaintenanceRoom } from "@/lib/room-reassignment";

const RoomUpdateSchema = z.object({
  number: z.string().min(1).optional(),
  name: z.string().optional(),
  floor: z.coerce.number().int().optional(),
  category: z.nativeEnum(RoomCategory).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
  baseRate: z.coerce.number().optional(),
  maxGuests: z.coerce.number().int().optional(),
  features: z.string().optional(),
  notes: z.string().optional(),
});

type RouteContext = { params?: Promise<{ roomId?: string }> };

const getRoomId = async (context: RouteContext) => {
  const params = await context.params;
  return typeof params?.roomId === "string" ? params.roomId : null;
};

export async function GET(_request: Request, context: RouteContext) {
  const roomId = await getRoomId(context);
  if (!roomId) {
    return NextResponse.json({ ok: false, message: "Invalid roomId." }, { status: 400 });
  }
  const hotel = await ensureDefaultHotel();
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId: hotel.id },
  });

  if (!room) {
    return NextResponse.json({ ok: false, message: "Room not found." }, { status: 404 });
  }

  return NextResponse.json(room);
}

export async function PATCH(request: Request, context: RouteContext) {
  const roomId = await getRoomId(context);
  if (!roomId) {
    return NextResponse.json({ ok: false, message: "Invalid roomId." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = RoomUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: roomId, hotelId: hotel.id },
      });
      if (!room) {
        return { notFound: true };
      }

      const nextStatus = data.status ?? room.status;
      if (nextStatus === RoomStatus.MAINTENANCE) {
        await reassignReservationsForMaintenanceRoom(tx, {
          hotelId: hotel.id,
          roomId: room.id,
        });
      }

      await tx.room.update({
        where: { id: roomId },
        data: {
          number: data.number,
          name: data.name,
          floor: data.floor,
          category: data.category,
          status: nextStatus,
          baseRate:
            data.baseRate !== undefined
              ? new Prisma.Decimal(data.baseRate)
              : undefined,
          maxGuests: data.maxGuests,
          features: data.features,
          notes: data.notes,
        },
      });

      return { notFound: false };
    });

    if (result.notFound) {
      return NextResponse.json({ ok: false, message: "Room not found." }, { status: 404 });
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to update room.";
    return NextResponse.json({ ok: false, message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const roomId = await getRoomId(context);
  if (!roomId) {
    return NextResponse.json({ ok: false, message: "Invalid roomId." }, { status: 400 });
  }
  const hotel = await ensureDefaultHotel();
  const result = await prisma.room.deleteMany({
    where: { id: roomId, hotelId: hotel.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ ok: false, message: "Room not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
