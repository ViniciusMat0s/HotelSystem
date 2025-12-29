"use server";

import { z } from "zod";
import {
  FeedbackStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@/generated/prisma";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

const FeedbackSchema = z.object({
  guestName: z.string().min(2),
  email: z.string().email(),
  reservationId: z.string().optional(),
});

export type FeedbackRequestState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

export async function requestFeedbackAction(
  _prevState: FeedbackRequestState,
  formData: FormData
): Promise<FeedbackRequestState> {
  const payload = FeedbackSchema.safeParse({
    guestName: formData.get("guestName")?.toString(),
    email: formData.get("email")?.toString(),
    reservationId: formData.get("reservationId")?.toString() || undefined,
  });

  if (!payload.success) {
    return { status: "error", message: "Preencha nome e email." };
  }

  const hotel = await ensureDefaultHotel();

  const request = await prisma.feedbackRequest.create({
    data: {
      hotelId: hotel.id,
      reservationId: payload.data.reservationId,
      guestName: payload.data.guestName,
      guestEmail: payload.data.email,
      status: FeedbackStatus.PENDING,
    },
  });

  await prisma.notification.create({
    data: {
      hotelId: hotel.id,
      reservationId: payload.data.reservationId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.FEEDBACK,
      status: NotificationStatus.QUEUED,
      toAddress: payload.data.email,
      subject: "Como foi sua estadia?",
      payload: {
        requestId: request.id,
        guestName: payload.data.guestName,
      },
    },
  });

  return { status: "ok", message: "Feedback agendado com sucesso." };
}
