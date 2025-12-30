import { NextResponse } from "next/server";
import { processRecurringExpenses } from "@/lib/recurring-expenses";

export async function POST() {
  const result = await processRecurringExpenses();
  return NextResponse.json({ ok: true, result });
}

export async function GET() {
  const result = await processRecurringExpenses();
  return NextResponse.json({ ok: true, result });
}
