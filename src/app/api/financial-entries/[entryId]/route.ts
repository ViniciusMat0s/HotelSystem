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

const FinancialUpdateSchema = z.object({
  reservationId: z.string().optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  type: z.nativeEnum(FinancialEntryType).optional(),
  category: z.nativeEnum(FinancialCategory).optional(),
  profitCenter: z.nativeEnum(ProfitCenter).optional(),
  roomCategory: z.nativeEnum(RoomCategory).optional(),
  packageType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  grossAmount: z.coerce.number().optional(),
  netAmount: z.coerce.number().optional(),
  taxAmount: z.coerce.number().optional(),
  currency: z.string().optional(),
  seasonType: z.nativeEnum(SeasonType).optional(),
  source: z.nativeEnum(FinancialSource).optional(),
});

type RouteContext = { params?: Promise<{ entryId?: string }> };

const getEntryId = async (context: RouteContext) => {
  const params = await context.params;
  return typeof params?.entryId === "string" ? params.entryId : null;
};

export async function GET(_request: Request, context: RouteContext) {
  const entryId = await getEntryId(context);
  if (!entryId) {
    return NextResponse.json(
      { ok: false, message: "Invalid entryId." },
      { status: 400 }
    );
  }
  const hotel = await ensureDefaultHotel();
  const entry = await prisma.financialEntry.findFirst({
    where: { id: entryId, hotelId: hotel.id },
  });

  if (!entry) {
    return NextResponse.json(
      { ok: false, message: "Entry not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(entry);
}

export async function PATCH(request: Request, context: RouteContext) {
  const entryId = await getEntryId(context);
  if (!entryId) {
    return NextResponse.json(
      { ok: false, message: "Invalid entryId." },
      { status: 400 }
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = FinancialUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hotel = await ensureDefaultHotel();
  const data = parsed.data;

  const updated = await prisma.financialEntry.updateMany({
    where: { id: entryId, hotelId: hotel.id },
    data: {
      reservationId: data.reservationId ?? undefined,
      occurredAt: data.occurredAt,
      type: data.type,
      category: data.category,
      profitCenter: data.profitCenter,
      roomCategory: data.roomCategory,
      packageType: data.packageType ?? undefined,
      description: data.description ?? undefined,
      grossAmount:
        data.grossAmount !== undefined
          ? new Prisma.Decimal(data.grossAmount)
          : undefined,
      netAmount:
        data.netAmount !== undefined
          ? new Prisma.Decimal(data.netAmount)
          : undefined,
      taxAmount:
        data.taxAmount !== undefined
          ? new Prisma.Decimal(data.taxAmount)
          : undefined,
      currency: data.currency,
      seasonType: data.seasonType,
      source: data.source,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { ok: false, message: "Entry not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const entryId = await getEntryId(context);
  if (!entryId) {
    return NextResponse.json(
      { ok: false, message: "Invalid entryId." },
      { status: 400 }
    );
  }
  const hotel = await ensureDefaultHotel();
  const result = await prisma.financialEntry.deleteMany({
    where: { id: entryId, hotelId: hotel.id },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { ok: false, message: "Entry not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
