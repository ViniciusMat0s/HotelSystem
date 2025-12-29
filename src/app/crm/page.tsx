import { Panel, Pill } from "@/components/cards";
import { getCrmSnapshot } from "@/lib/crm";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export default async function CrmPage() {
  const crm = await getCrmSnapshot();
  const hotel = await ensureDefaultHotel();
  const achievements = await prisma.achievement.findMany({
    where: { hotelId: hotel.id },
    orderBy: { achievedAt: "desc" },
    take: 4,
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="Base de clientes" description="CRM com automacao.">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="font-display text-lg">
                {crm.totalGuests}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Opt-in promocional</span>
              <span className="font-display text-lg">{crm.optedIn}</span>
            </div>
          </div>
        </Panel>
        <Panel
          title="Perfis dificeis"
          description="Identificacao automatica de riscos."
        >
          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-strong px-4 py-5 text-sm">
            <span>Clientes criticos</span>
            <span className="font-display text-2xl text-foreground">
              {crm.difficultGuests}
            </span>
          </div>
        </Panel>
        <Panel
          title="Campanhas"
          description="Reciclagem e promocoes segmentadas."
        >
          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-strong px-4 py-5 text-sm">
            <span>Ativas</span>
            <span className="font-display text-2xl text-foreground">
              {crm.activeCampaigns}
            </span>
          </div>
        </Panel>
      </section>

      <Panel
        title="Historico de campanhas"
        description="Automacoes recentes do CRM."
      >
        {crm.campaigns.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma campanha criada. Planeje a proxima rodada.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {crm.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <div>
                  <p className="font-display text-base">{campaign.name}</p>
                  <p className="text-xs text-muted">{campaign.type}</p>
                </div>
                <Pill tone="positive">{campaign.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Gamificacao"
        description="Marcos e trofeus de reputacao."
      >
        {achievements.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum marco registrado. Configure os criterios de premiacao.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base">
                    {achievement.title}
                  </span>
                  <Pill tone="positive">{achievement.type}</Pill>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {achievement.description ?? "Premio especial"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
