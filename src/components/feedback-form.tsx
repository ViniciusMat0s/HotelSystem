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
      <button
        type="submit"
        className="btn btn-primary"
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
