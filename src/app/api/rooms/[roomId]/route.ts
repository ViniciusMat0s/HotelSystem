import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, RoomCategory, RoomStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

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

type RouteContext = { params: { roomId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const hotel = await ensureDefaultHotel();
  const room = await prisma.room.findFirst({
    where: { id: context.params.roomId, hotelId: hotel.id },
  });

  if (!room) {
    return NextResponse.json({ ok: false, message: "Room not found." }, { status: 404 });
  }

  return NextResponse.json(room);
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const room = await prisma.room.updateMany({
    where: { id: context.params.roomId, hotelId: hotel.id },
    data: {
      number: data.number,
      name: data.name,
      floor: data.floor,
      category: data.category,
      status: data.status,
      baseRate:
        data.baseRate !== undefined
          ? new Prisma.Decimal(data.baseRate)
          : undefined,
      maxGuests: data.maxGuests,
      features: data.features,
      notes: data.notes,
    },
  });

  if (room.count === 0) {
    return NextResponse.json({ ok: false, message: "Room not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const hotel = await ensureDefaultHotel();
  const result = await prisma.room.deleteMany({
    where: { id: context.params.roomId, hotelId: hotel.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ ok: false, message: "Room not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
