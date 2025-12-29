"use server";

import { ExternalChannel } from "@/generated/prisma";
import { triggerChannelSync } from "@/lib/integrations";

export async function syncChannelAction(channel: ExternalChannel) {
  return triggerChannelSync(channel);
}
