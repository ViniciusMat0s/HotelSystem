"use client";

import { useActionState, useMemo, useState } from "react";
import {
  ingestExpenseInvoiceAction,
  type ExpenseIngestState,
} from "@/actions/finance";
import { ActionModal } from "@/components/action-modal";
import { formatCurrency } from "@/lib/format";

const PROVIDER_LABELS: Record<string, string> = {
  WATER: "Agua",
  POWER: "Energia",
  INTERNET: "Internet",
  TV: "TV",
  OTHER: "Outros",
};

const initialState: ExpenseIngestState = { status: "idle" };

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
};

export function ExpenseIngestForm() {
  const [state, formAction] = useActionState(
    ingestExpenseInvoiceAction,
    initialState
  );
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const modalKey =
    state.status === "idle"
      ? null
      : [state.status, state.message ?? "", state.invoiceId ?? ""].join("|");
  const isModalOpen = modalKey !== null && modalKey !== dismissedKey;

  const handleModalClose = () => {
    if (modalKey) {
      setDismissedKey(modalKey);
    }
  };

  const modalTone = state.status === "error" ? "error" : "success";
  const modalTitle =
    state.status === "error" ? "Falha na leitura" : "Fatura registrada";

  const modalDetails = useMemo(() => {
    if (state.status !== "ok") return undefined;
    const details: string[] = [];
    if (state.provider) {
      details.push(
        `Fornecedor: ${PROVIDER_LABELS[state.provider] ?? state.provider}`
      );
    }
    if (typeof state.amount === "number") {
      details.push(`Valor: ${formatCurrency(state.amount)}`);
    }
    const dueDateLabel = formatDate(state.dueDate);
    if (dueDateLabel) {
      details.push(`Vencimento: ${dueDateLabel}`);
    }
    return details.length ? details.join(" | ") : undefined;
  }, [state.amount, state.dueDate, state.provider, state.status]);

  return (
    <>
      <form action={formAction} className="space-y-3 text-sm">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Texto da fatura (email)
          </span>
          <textarea
            name="emailText"
            className="input-field min-h-[120px] resize-none"
            placeholder="Cole aqui o corpo do email da fatura."
            required
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <button type="submit" className="btn btn-primary btn-sm">
            Ingerir fatura
          </button>
          <span>Detecta agua, energia, internet e TV automaticamente.</span>
        </div>
      </form>

      <ActionModal
        open={isModalOpen}
        tone={modalTone}
        title={modalTitle}
        description={state.message}
        details={modalDetails}
        onClose={handleModalClose}
        actionLabel="Ok, entendi"
      />
    </>
  );
}
