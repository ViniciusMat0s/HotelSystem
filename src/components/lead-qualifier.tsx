"use client";

import { useFormState } from "react-dom";
import {
  qualifyLeadAction,
  type LeadQualificationState,
} from "@/actions/lead";
import { Pill } from "@/components/cards";

const initialState: LeadQualificationState = { status: "idle" };

export function LeadQualifier() {
  const [state, formAction] = useFormState(qualifyLeadAction, initialState);

  return (
    <form action={formAction} className="space-y-4 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="name"
          placeholder="Nome do hospede"
          className="input-field"
        />
        <input
          name="contact"
          placeholder="Email ou WhatsApp"
          className="input-field"
        />
        <input
          type="date"
          name="checkIn"
          className="input-field"
        />
        <input
          type="date"
          name="checkOut"
          className="input-field"
        />
        <input
          name="partySize"
          placeholder="Numero de pessoas"
          className="input-field"
        />
        <input
          name="budgetMax"
          placeholder="Budget max (R$)"
          className="input-field"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
      >
        Qualificar lead
      </button>

      {state.status === "error" ? (
        <p className="text-xs text-primary">{state.message}</p>
      ) : null}

      {state.status === "ok" && state.result ? (
        <div className="card-lite rounded-2xl border border-border bg-surface-strong p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg text-foreground">
              Score {state.result.score}
            </p>
            <Pill tone={state.result.handoffRecommended ? "positive" : "warning"}>
              {state.result.status}
            </Pill>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {state.result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

