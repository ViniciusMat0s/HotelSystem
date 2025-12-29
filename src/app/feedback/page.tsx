import { Panel } from "@/components/cards";
import { FeedbackForm } from "@/components/feedback-form";
import { ensureDefaultHotel } from "@/lib/hotel";
import { prisma } from "@/lib/prisma";

export default async function FeedbackPage() {
  const hotel = await ensureDefaultHotel();
  const requests = await prisma.feedbackRequest.findMany({
    where: { hotelId: hotel.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <div className="space-y-8">
      <Panel
        title="Pos-venda"
        description="Envio automatico de feedback apos o checkout."
      >
        <FeedbackForm />
      </Panel>

      <Panel
        title="Historico de feedback"
        description="Monitoramento de respostas e scores."
      >
        {requests.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum feedback enviado ainda.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <span>{request.guestName ?? "Hospede"}</span>
                <span className="text-xs text-muted">
                  {request.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

