import { NextResponse } from "next/server";
import { getOccupancyReport } from "@/lib/reports/occupancy";

export async function GET() {
  const report = await getOccupancyReport();
  return NextResponse.json(report);
}
