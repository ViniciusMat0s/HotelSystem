"use client";

import { useActionState, useState } from "react";
import {
  requestFeedbackAction,
  type FeedbackRequestState,
} from "@/actions/feedback";
import { ActionModal } from "@/components/action-modal";

const initialState: FeedbackRequestState = { status: "idle" };

export function FeedbackForm() {
  const [state, formAction] = useActionState(requestFeedbackAction, initialState);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const modalTitle =
    state.status === "error" ? "Feedback nao enviado" : "Feedback agendado";
  const modalTone = state.status === "error" ? "error" : "success";
  const modalKey =
    state.status === "idle"
      ? null
      : [state.status, state.message ?? ""].join("|");
  const isModalOpen = modalKey !== null && modalKey !== dismissedKey;
  const handleModalClose = () => {
    if (modalKey) {
      setDismissedKey(modalKey);
    }
  };

  return (
    <>
      <form action={formAction} className="space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            name="guestName"
            placeholder="Nome do hospede"
            className="input-field"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="input-field"
          />
          <input
            name="reservationId"
            placeholder="Codigo da reserva (opcional)"
            className="input-field md:col-span-2"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Disparar feedback
        </button>
      </form>
      <ActionModal
        open={isModalOpen}
        tone={modalTone}
        title={modalTitle}
        description={state.message}
        onClose={handleModalClose}
        actionLabel="Ok, entendi"
      />
    </>
  );
}
