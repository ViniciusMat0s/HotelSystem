import { Panel, Pill } from "@/components/cards";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getDynamicPricingSuggestion } from "@/lib/reports/pricing";

export default async function PricingPage() {
  const suggestion = await getDynamicPricingSuggestion();

  return (
    <div className="space-y-8">
      <Panel
        title="Precificacao dinamica"
        description="Sugestao baseada em concorrentes, avaliacao e clima."
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-3xl border border-border bg-surface-strong p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Sugestao atual
            </p>
            <p className="mt-4 font-display text-4xl text-foreground">
              {formatCurrency(suggestion.suggestedRate)}
            </p>
            <p className="mt-2 text-sm text-muted">
              Base concorrencia: {formatCurrency(suggestion.baseRate)}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Avaliacao relativa</span>
                <span>{suggestion.drivers.ratingDelta.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Ocupacao</span>
                <span>{formatPercent(suggestion.drivers.occupancyRate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Clima</span>
                <span>{suggestion.drivers.weatherSummary}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Comparativo regional
            </p>
            {suggestion.competitors.length === 0 ? (
              <p className="text-sm text-muted">
                Sem concorrentes cadastrados para analise.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestion.competitors.map((comp) => (
                  <div
                    key={comp.name}
                    className="rounded-2xl border border-border bg-surface-strong p-4 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-base">{comp.name}</span>
                      <Pill tone="positive">
                        {comp.rating?.toFixed(1) ?? "4.3"}
                      </Pill>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {comp.distanceKm ? `${comp.distanceKm} km` : "Area local"}
                    </p>
                    <p className="mt-3 font-display text-lg text-foreground">
                      {formatCurrency(comp.lastRate)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
