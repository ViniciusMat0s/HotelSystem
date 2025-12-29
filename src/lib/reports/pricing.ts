import { prisma } from "@/lib/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { getOccupancyReport } from "@/lib/reports/occupancy";

const toNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value ?? 0);

export async function getDynamicPricingSuggestion(hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();
  const occupancy = await getOccupancyReport(hotel.id);

  const competitors = await prisma.competitorHotel.findMany({
    where: { hotelId: hotel.id },
    include: {
      snapshots: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const competitorRates = competitors
    .map((comp) => toNumber(comp.snapshots[0]?.rate))
    .filter((rate) => !Number.isNaN(rate) && rate > 0);
  const competitorRatings = competitors
    .map((comp) => comp.rating ?? 0)
    .filter((rating) => rating > 0);

  const averageCompetitorRate =
    competitorRates.reduce((sum, rate) => sum + rate, 0) /
    (competitorRates.length || 1);
  const averageCompetitorRating =
    competitorRatings.reduce((sum, rating) => sum + rating, 0) /
    (competitorRatings.length || 1);

  const weather = await prisma.weatherSnapshot.findFirst({
    where: { hotelId: hotel.id },
    orderBy: { date: "desc" },
  });

  const ratingDelta = (hotel.rating ?? 4.3) - averageCompetitorRating;
  const ratingAdjustment = averageCompetitorRate * (ratingDelta * 0.04);
  const occupancyAdjustment =
    occupancy.occupancyRate >= 0.8
      ? averageCompetitorRate * 0.12
      : occupancy.occupancyRate <= 0.5
      ? averageCompetitorRate * -0.08
      : 0;

  const weatherAdjustment = weather
    ? weather.precipitationChance && weather.precipitationChance > 0.6
      ? averageCompetitorRate * -0.06
      : weather.temperatureC && weather.temperatureC > 28
      ? averageCompetitorRate * 0.04
      : weather.temperatureC && weather.temperatureC < 16
      ? averageCompetitorRate * -0.05
      : 0
    : 0;

  const suggestedRate = Math.max(
    0,
    averageCompetitorRate + ratingAdjustment + occupancyAdjustment + weatherAdjustment
  );

  return {
    baseRate: averageCompetitorRate,
    suggestedRate,
    drivers: {
      ratingDelta,
      occupancyRate: occupancy.occupancyRate,
      weatherSummary: weather?.summary ?? "Sem dados",
    },
    competitors: competitors.map((comp) => ({
      name: comp.name,
      rating: comp.rating,
      distanceKm: comp.distanceKm,
      lastRate: toNumber(comp.snapshots[0]?.rate),
    })),
  };
}
