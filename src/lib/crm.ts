import { CampaignStatus } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export async function getCrmSnapshot(hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();

  const guests = await prisma.guest.findMany({
    where: { hotelId: hotel.id },
    select: { difficultyScore: true, marketingOptIn: true },
  });

  const totalGuests = guests.length;
  const difficultGuests = guests.filter((guest) => guest.difficultyScore >= 7)
    .length;
  const optedIn = guests.filter((guest) => guest.marketingOptIn).length;

  const campaigns = await prisma.campaign.findMany({
    where: { hotelId: hotel.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === CampaignStatus.ACTIVE
  ).length;

  return {
    totalGuests,
    difficultGuests,
    optedIn,
    activeCampaigns,
    campaigns,
  };
}
