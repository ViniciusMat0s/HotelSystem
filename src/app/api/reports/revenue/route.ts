import { NextResponse } from "next/server";
import { getRevenueSummary } from "@/lib/reports/finance";

export async function GET() {
  const summary = await getRevenueSummary();
  return NextResponse.json(summary);
}
