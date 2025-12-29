"use client";

import { useTransition } from "react";
import { ExternalChannel } from "@/generated/prisma";
import { syncChannelAction } from "@/actions/sync";

type ChannelStatus = {
  channel: ExternalChannel;
  status: string;
  lastSyncAt: string | null;
  message: string;
};

export function ChannelSyncActions({ channels }: { channels: ChannelStatus[] }) {
  const [isPending, startTransition] = useTransition();

  const handleSync = (channel: ExternalChannel) => {
    startTransition(async () => {
      await syncChannelAction(channel);
    });
  };

  return (
    <div className="space-y-3 text-sm">
      {channels.map((channel) => (
        <div
          key={channel.channel}
          className="flex flex-wrap items-center justify-between gap-2 card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
        >
          <div>
            <p className="font-display text-base">{channel.channel}</p>
            <p className="text-xs text-muted">
              {channel.message} -{" "}
              {channel.lastSyncAt
                ? new Date(channel.lastSyncAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sem dados"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSync(channel.channel)}
            className="btn btn-outline btn-sm"
          >
            {isPending ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      ))}
    </div>
  );
}

