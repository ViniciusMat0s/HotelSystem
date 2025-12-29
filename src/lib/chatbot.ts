import { differenceInCalendarDays } from "date-fns";
import { LeadStatus } from "@/generated/prisma";

export type LeadInput = {
  name?: string;
  contact?: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
  partySize?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

export type LeadQualification = {
  score: number;
  status: LeadStatus;
  reasons: string[];
  handoffRecommended: boolean;
};

export function qualifyLead(input: LeadInput): LeadQualification {
  const reasons: string[] = [];
  let score = 0;

  if (input.checkIn && input.checkOut) {
    const nights = Math.max(
      1,
      differenceInCalendarDays(input.checkOut, input.checkIn)
    );
    score += 20;
    reasons.push(`Datas completas (${nights} noites)`);
  } else {
    reasons.push("Datas incompletas");
  }

  if (input.partySize && input.partySize > 0) {
    score += 15;
    reasons.push(`Grupo com ${input.partySize} pessoas`);
  }

  if (input.budgetMin || input.budgetMax) {
    score += 20;
    reasons.push("Orcamento informado");
  }

  if (input.contact) {
    score += 15;
    reasons.push("Contato direto confirmado");
  }

  const budgetSignal =
    input.budgetMax && input.checkIn && input.checkOut
      ? input.budgetMax /
        Math.max(1, differenceInCalendarDays(input.checkOut, input.checkIn))
      : null;

  if (budgetSignal && budgetSignal >= 320) {
    score += 20;
    reasons.push("Ticket medio alinhado");
  } else if (budgetSignal && budgetSignal < 220) {
    score -= 10;
    reasons.push("Ticket abaixo do esperado");
  }

  const status =
    score >= 70
      ? LeadStatus.QUALIFIED
      : score >= 45
      ? LeadStatus.NURTURE
      : LeadStatus.UNQUALIFIED;

  return {
    score,
    status,
    reasons,
    handoffRecommended: status === LeadStatus.QUALIFIED,
  };
}
