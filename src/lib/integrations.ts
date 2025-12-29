import { ChannelSyncStatus, ExternalChannel } from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export async function getChannelSyncStatus(hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();

  const records = await prisma.channelSync.findMany({
    where: { hotelId: hotel.id },
  });

  const byChannel = new Map<ExternalChannel, typeof records[number]>();
  records.forEach((record) => byChannel.set(record.channel, record));

  return [ExternalChannel.BOOKING, ExternalChannel.WHATSAPP].map((channel) => {
    const record = byChannel.get(channel);
    return {
      channel,
      status: record?.status ?? ChannelSyncStatus.IDLE,
      lastSyncAt: record?.lastSyncAt
        ? record.lastSyncAt.toISOString()
        : null,
      message: record?.message ?? "Sem sincronizacao recente",
    };
  });
}

export async function triggerChannelSync(channel: ExternalChannel, hotelId?: string) {
  const hotel = hotelId ? { id: hotelId } : await ensureDefaultHotel();

  return prisma.channelSync.upsert({
    where: {
      hotelId_channel: {
        hotelId: hotel.id,
        channel,
      },
    },
    update: {
      status: ChannelSyncStatus.OK,
      lastSyncAt: new Date(),
      message: "Sincronizacao concluida",
    },
    create: {
      hotelId: hotel.id,
      channel,
      status: ChannelSyncStatus.OK,
      lastSyncAt: new Date(),
      message: "Primeira sincronizacao concluida",
    },
  });
}
