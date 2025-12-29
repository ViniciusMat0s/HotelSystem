const {
  PrismaClient,
  Prisma,
  RoomCategory,
  RoomStatus,
  ReservationStatus,
  ReservationSource,
  PaymentStatus,
  SeasonType,
  FinancialEntryType,
  FinancialCategory,
  ProfitCenter,
  FinancialSource,
  MaintenanceCategory,
  MaintenanceSeverity,
  RoomIssueStatus,
  ChannelSyncStatus,
  ExternalChannel,
  CampaignType,
  CampaignStatus,
  AchievementType,
  FeedbackStatus,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
} = require("../src/generated/prisma");

const prisma = new PrismaClient();

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

async function main() {
  const hotel = await prisma.hotel.upsert({
    where: { slug: "vennity-flagship" },
    update: {
      name: "Vennity Flagship",
      brandName: "Vennity",
      city: "Sao Paulo",
      country: "BR",
      rating: 4.7,
    },
    create: {
      slug: "vennity-flagship",
      name: "Vennity Flagship",
      brandName: "Vennity",
      city: "Sao Paulo",
      country: "BR",
      rating: 4.7,
      timezone: "America/Sao_Paulo",
    },
  });

  const roomsCount = await prisma.room.count({ where: { hotelId: hotel.id } });
  if (roomsCount === 0) {
    const rooms = Array.from({ length: 16 }).map((_, index) => ({
      hotelId: hotel.id,
      number: `${index + 101}`,
      floor: index < 8 ? 1 : 2,
      category:
        index % 5 === 0
          ? RoomCategory.SUITE
          : index % 3 === 0
          ? RoomCategory.DELUXE
          : RoomCategory.STANDARD,
      status:
        index % 7 === 0
          ? RoomStatus.MAINTENANCE
          : index % 5 === 0
          ? RoomStatus.OCCUPIED
          : RoomStatus.AVAILABLE,
      baseRate: new Prisma.Decimal(index % 5 === 0 ? 720 : 480),
      maxGuests: index % 5 === 0 ? 4 : 2,
      features: index % 5 === 0 ? "Vista mar, varanda" : "Vista cidade",
    }));
    await prisma.room.createMany({ data: rooms });
  }

  const guestsCount = await prisma.guest.count({ where: { hotelId: hotel.id } });
  if (guestsCount === 0) {
    await prisma.guest.createMany({
      data: [
        {
          hotelId: hotel.id,
          firstName: "Livia",
          lastName: "Gomes",
          email: "livia@vennity.com.br",
          phone: "+5511999991001",
          marketingOptIn: true,
          difficultyScore: 2,
        },
        {
          hotelId: hotel.id,
          firstName: "Rafael",
          lastName: "Alves",
          email: "rafael@vennity.com.br",
          phone: "+5511999991002",
          marketingOptIn: false,
          difficultyScore: 6,
        },
        {
          hotelId: hotel.id,
          firstName: "Camila",
          lastName: "Souza",
          email: "camila@vennity.com.br",
          phone: "+5511999991003",
          marketingOptIn: true,
          difficultyScore: 3,
        },
      ],
    });
  }

  const reservationsCount = await prisma.reservation.count({
    where: { hotelId: hotel.id },
  });
  if (reservationsCount === 0) {
    const rooms = await prisma.room.findMany({
      where: { hotelId: hotel.id },
      take: 4,
    });
    const guests = await prisma.guest.findMany({
      where: { hotelId: hotel.id },
      take: 3,
    });
    const today = new Date();
    const reservationData = [
      {
        hotelId: hotel.id,
        roomId: rooms[0]?.id,
        guestId: guests[0]?.id,
        status: ReservationStatus.BOOKED,
        source: ReservationSource.WHATSAPP,
        paymentStatus: PaymentStatus.PENDING,
        roomCategory: rooms[0]?.category ?? RoomCategory.STANDARD,
        checkIn: addDays(today, 1),
        checkOut: addDays(today, 4),
        adults: 2,
        totalAmount: new Prisma.Decimal(2100),
        seasonType: SeasonType.HIGH,
      },
      {
        hotelId: hotel.id,
        roomId: rooms[1]?.id,
        guestId: guests[1]?.id,
        status: ReservationStatus.CHECKED_IN,
        source: ReservationSource.BOOKING,
        paymentStatus: PaymentStatus.PAID,
        roomCategory: rooms[1]?.category ?? RoomCategory.DELUXE,
        checkIn: addDays(today, -1),
        checkOut: addDays(today, 2),
        adults: 2,
        totalAmount: new Prisma.Decimal(1800),
        seasonType: SeasonType.HIGH,
      },
      {
        hotelId: hotel.id,
        roomId: rooms[2]?.id,
        guestId: guests[2]?.id,
        status: ReservationStatus.CHECKED_OUT,
        source: ReservationSource.DIRECT,
        paymentStatus: PaymentStatus.PAID,
        roomCategory: rooms[2]?.category ?? RoomCategory.STANDARD,
        checkIn: addDays(today, -6),
        checkOut: addDays(today, -3),
        adults: 1,
        totalAmount: new Prisma.Decimal(1200),
        seasonType: SeasonType.LOW,
      },
    ].filter((item) => item.roomId && item.guestId);

    await prisma.reservation.createMany({ data: reservationData });
  }

  const financialCount = await prisma.financialEntry.count({
    where: { hotelId: hotel.id },
  });
  if (financialCount === 0) {
    const reservations = await prisma.reservation.findMany({
      where: { hotelId: hotel.id },
      take: 3,
    });
    await prisma.financialEntry.createMany({
      data: [
        {
          hotelId: hotel.id,
          reservationId: reservations[0]?.id,
          occurredAt: new Date(),
          type: FinancialEntryType.REVENUE,
          category: FinancialCategory.ROOM,
          profitCenter: ProfitCenter.ROOM,
          roomCategory: RoomCategory.STANDARD,
          netAmount: new Prisma.Decimal(1100),
          grossAmount: new Prisma.Decimal(1300),
          source: FinancialSource.RESERVATION,
          seasonType: SeasonType.HIGH,
        },
        {
          hotelId: hotel.id,
          reservationId: reservations[1]?.id,
          occurredAt: addDays(new Date(), -2),
          type: FinancialEntryType.REVENUE,
          category: FinancialCategory.PACKAGE,
          profitCenter: ProfitCenter.PACKAGE,
          roomCategory: RoomCategory.DELUXE,
          packageType: "Romance",
          netAmount: new Prisma.Decimal(1600),
          grossAmount: new Prisma.Decimal(1900),
          source: FinancialSource.RESERVATION,
          seasonType: SeasonType.HIGH,
        },
        {
          hotelId: hotel.id,
          occurredAt: addDays(new Date(), -1),
          type: FinancialEntryType.REVENUE,
          category: FinancialCategory.FOOD_BEVERAGE,
          profitCenter: ProfitCenter.CONSUMPTION,
          netAmount: new Prisma.Decimal(420),
          grossAmount: new Prisma.Decimal(520),
          source: FinancialSource.POS,
          seasonType: SeasonType.LOW,
        },
      ],
    });
  }

  const vendorsCount = await prisma.maintenanceVendor.count({
    where: { hotelId: hotel.id },
  });
  if (vendorsCount === 0) {
    await prisma.maintenanceVendor.createMany({
      data: [
        {
          hotelId: hotel.id,
          name: "Equipe Hidro Pro",
          category: MaintenanceCategory.PLUMBING,
          rating: 4.8,
          city: "Sao Paulo",
        },
        {
          hotelId: hotel.id,
          name: "ClimaTech",
          category: MaintenanceCategory.HVAC,
          rating: 4.6,
          city: "Sao Paulo",
        },
      ],
    });
  }

  const issuesCount = await prisma.roomIssue.count();
  if (issuesCount === 0) {
    const room = await prisma.room.findFirst({
      where: { hotelId: hotel.id },
    });
    if (room) {
      await prisma.roomIssue.create({
        data: {
          roomId: room.id,
          category: MaintenanceCategory.PLUMBING,
          status: RoomIssueStatus.OPEN,
          severity: MaintenanceSeverity.HIGH,
          description: "Vazamento recorrente no banheiro.",
        },
      });
    }
  }

  const channelsCount = await prisma.channelSync.count({
    where: { hotelId: hotel.id },
  });
  if (channelsCount === 0) {
    await prisma.channelSync.createMany({
      data: [
        {
          hotelId: hotel.id,
          channel: ExternalChannel.BOOKING,
          status: ChannelSyncStatus.OK,
          lastSyncAt: new Date(),
          message: "Sincronizacao concluida",
        },
        {
          hotelId: hotel.id,
          channel: ExternalChannel.WHATSAPP,
          status: ChannelSyncStatus.OK,
          lastSyncAt: new Date(),
          message: "Ativo",
        },
      ],
    });
  }

  const campaignsCount = await prisma.campaign.count({
    where: { hotelId: hotel.id },
  });
  if (campaignsCount === 0) {
    await prisma.campaign.createMany({
      data: [
        {
          hotelId: hotel.id,
          name: "Fidelidade Verão",
          type: CampaignType.LOYALTY,
          status: CampaignStatus.ACTIVE,
          segment: "Retorno",
        },
        {
          hotelId: hotel.id,
          name: "Recuperação de no-show",
          type: CampaignType.RECOVERY,
          status: CampaignStatus.SCHEDULED,
          segment: "No-show 90 dias",
        },
      ],
    });
  }

  const achievementsCount = await prisma.achievement.count({
    where: { hotelId: hotel.id },
  });
  if (achievementsCount === 0) {
    await prisma.achievement.createMany({
      data: [
        {
          hotelId: hotel.id,
          type: AchievementType.AWARD,
          title: "Traveller Awards 2025",
          description: "Top avaliacao regional",
        },
        {
          hotelId: hotel.id,
          type: AchievementType.MILESTONE,
          title: "1000 reservas confirmadas",
          description: "Marco de reservas confirmadas",
        },
      ],
    });
  }

  const feedbackCount = await prisma.feedbackRequest.count({
    where: { hotelId: hotel.id },
  });
  if (feedbackCount === 0) {
    await prisma.feedbackRequest.create({
      data: {
        hotelId: hotel.id,
        guestName: "Livia Gomes",
        guestEmail: "livia@vennity.com.br",
        status: FeedbackStatus.PENDING,
      },
    });
  }

  const notificationCount = await prisma.notification.count({
    where: { hotelId: hotel.id },
  });
  if (notificationCount === 0) {
    await prisma.notification.create({
      data: {
        hotelId: hotel.id,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.CONFIRMATION,
        status: NotificationStatus.QUEUED,
        toAddress: "livia@vennity.com.br",
        subject: "Confirmacao de reserva",
        payload: { reservationCode: "VN-2025-001" },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
