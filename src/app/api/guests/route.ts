import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const GuestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  documentId: z.string().optional(),
  nationality: z.string().optional(),
  marketingOptIn: z.coerce.boolean().optional(),
  profileNote: z.string().optional(),
  difficultyScore: z.coerce.number().int().min(0).max(10).optional(),
});

export async function GET() {
  const hotel = await ensureDefaultHotel();
  const guests = await prisma.guest.findMany({
    where: { hotelId: hotel.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(guests);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = GuestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const payload = parsed.data;

  const guest = await prisma.guest.create({
    data: {
      hotelId: hotel.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      documentId: payload.documentId,
      nationality: payload.nationality,
      marketingOptIn: payload.marketingOptIn ?? false,
      profileNote: payload.profileNote,
      difficultyScore: payload.difficultyScore ?? 0,
    },
  });

  return NextResponse.json({ ok: true, guest }, { status: 201 });
}
