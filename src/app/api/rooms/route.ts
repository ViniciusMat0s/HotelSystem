import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, RoomCategory, RoomStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const RoomSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  floor: z.coerce.number().int().optional(),
  category: z.nativeEnum(RoomCategory).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
  baseRate: z.coerce.number().optional(),
  maxGuests: z.coerce.number().int().optional(),
  features: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const hotel = await ensureDefaultHotel();
  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id },
    orderBy: { number: "asc" },
  });
  return NextResponse.json(rooms);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const payload = parsed.data;

  const room = await prisma.room.create({
    data: {
      hotelId: hotel.id,
      number: payload.number,
      name: payload.name,
      floor: payload.floor,
      category: payload.category ?? RoomCategory.STANDARD,
      status: payload.status ?? RoomStatus.AVAILABLE,
      baseRate:
        payload.baseRate !== undefined
          ? new Prisma.Decimal(payload.baseRate)
          : undefined,
      maxGuests: payload.maxGuests ?? 2,
      features: payload.features,
      notes: payload.notes,
    },
  });

  return NextResponse.json({ ok: true, room }, { status: 201 });
}
