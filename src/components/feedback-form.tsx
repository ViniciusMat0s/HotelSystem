"use client";

import { useFormState } from "react-dom";
import {
  requestFeedbackAction,
  type FeedbackRequestState,
} from "@/actions/feedback";

const initialState: FeedbackRequestState = { status: "idle" };

export function FeedbackForm() {
  const [state, formAction] = useFormState(requestFeedbackAction, initialState);

  return (
    <form action={formAction} className="space-y-4 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="guestName"
          placeholder="Nome do hospede"
          className="rounded-2xl border border-border bg-surface-strong px-4 py-3"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-2xl border border-border bg-surface-strong px-4 py-3"
        />
        <input
          name="reservationId"
          placeholder="Codigo da reserva (opcional)"
          className="rounded-2xl border border-border bg-surface-strong px-4 py-3 md:col-span-2"
        />
      </div>
      <button
        type="submit"
        className="rounded-full bg-primary px-5 py-2 text-sm text-white"
      >
        Disparar feedback
      </button>
      {state.status === "error" ? (
        <p className="text-xs text-primary">{state.message}</p>
      ) : null}
      {state.status === "ok" ? (
        <p className="text-xs text-secondary">{state.message}</p>
      ) : null}
    </form>
  );
}
