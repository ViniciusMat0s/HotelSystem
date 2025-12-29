import { prisma } from "@/lib/prisma";

export const DEFAULT_HOTEL_SLUG = "vennity-flagship";

export async function ensureDefaultHotel() {
  const existing = await prisma.hotel.findUnique({
    where: { slug: DEFAULT_HOTEL_SLUG },
  });

  if (existing) {
    return existing;
  }

  return prisma.hotel.create({
    data: {
      slug: DEFAULT_HOTEL_SLUG,
      name: "Vennity Flagship",
      brandName: "Vennity",
      city: "Sao Paulo",
      country: "BR",
      rating: 4.6,
      timezone: "America/Sao_Paulo",
    },
  });
}
