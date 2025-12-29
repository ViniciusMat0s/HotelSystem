import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FinancialCategory,
  FinancialEntryType,
  FinancialSource,
  Prisma,
  ProfitCenter,
  RoomCategory,
  SeasonType,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const FinancialSchema = z.object({
  reservationId: z.string().optional(),
  occurredAt: z.coerce.date(),
  type: z.nativeEnum(FinancialEntryType),
  category: z.nativeEnum(FinancialCategory),
  profitCenter: z.nativeEnum(ProfitCenter),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  packageType: z.string().optional(),
  description: z.string().optional(),
  grossAmount: z.coerce.number().optional(),
  netAmount: z.coerce.number(),
  taxAmount: z.coerce.number().optional(),
  currency: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  source: z.nativeEnum(FinancialSource),
});

export async function GET() {
  const hotel = await ensureDefaultHotel();
  const entries = await prisma.financialEntry.findMany({
    where: { hotelId: hotel.id },
    orderBy: { occurredAt: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = FinancialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const payload = parsed.data;

  const entry = await prisma.financialEntry.create({
    data: {
      hotelId: hotel.id,
      reservationId: payload.reservationId,
      occurredAt: payload.occurredAt,
      type: payload.type,
      category: payload.category,
      profitCenter: payload.profitCenter,
      roomCategory: payload.roomCategory,
      packageType: payload.packageType,
      description: payload.description,
      grossAmount:
        payload.grossAmount !== undefined
          ? new Prisma.Decimal(payload.grossAmount)
          : undefined,
      netAmount: new Prisma.Decimal(payload.netAmount),
      taxAmount:
        payload.taxAmount !== undefined
          ? new Prisma.Decimal(payload.taxAmount)
          : undefined,
      currency: payload.currency ?? "BRL",
      seasonType: payload.seasonType,
      source: payload.source,
    },
  });

  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
