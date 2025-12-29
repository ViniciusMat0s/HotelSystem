import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const GuestUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  marketingOptIn: z.coerce.boolean().optional(),
  profileNote: z.string().optional().nullable(),
  difficultyScore: z.coerce.number().int().min(0).max(10).optional(),
});

type RouteContext = { params: { guestId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const hotel = await ensureDefaultHotel();
  const guest = await prisma.guest.findFirst({
    where: { id: context.params.guestId, hotelId: hotel.id },
  });

  if (!guest) {
    return NextResponse.json({ ok: false, message: "Guest not found." }, { status: 404 });
  }

  return NextResponse.json(guest);
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => null);
  const parsed = GuestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const data = parsed.data;

  const updated = await prisma.guest.updateMany({
    where: { id: context.params.guestId, hotelId: hotel.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      documentId: data.documentId ?? undefined,
      nationality: data.nationality ?? undefined,
      marketingOptIn: data.marketingOptIn,
      profileNote: data.profileNote ?? undefined,
      difficultyScore: data.difficultyScore,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ ok: false, message: "Guest not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const hotel = await ensureDefaultHotel();
  const result = await prisma.guest.deleteMany({
    where: { id: context.params.guestId, hotelId: hotel.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ ok: false, message: "Guest not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
