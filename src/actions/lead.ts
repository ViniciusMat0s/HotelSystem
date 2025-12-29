"use server";

import { z } from "zod";
import { qualifyLead } from "@/lib/chatbot";

const LeadSchema = z.object({
  name: z.string().optional(),
  contact: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  partySize: z.string().optional(),
  budgetMin: z.string().optional(),
  budgetMax: z.string().optional(),
});

export type LeadQualificationState = {
  status: "idle" | "error" | "ok";
  message?: string;
  result?: ReturnType<typeof qualifyLead>;
};

const parseNumber = (value?: string) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function qualifyLeadAction(
  _prevState: LeadQualificationState,
  formData: FormData
): Promise<LeadQualificationState> {
  const raw = LeadSchema.safeParse({
    name: formData.get("name")?.toString(),
    contact: formData.get("contact")?.toString(),
    checkIn: formData.get("checkIn")?.toString(),
    checkOut: formData.get("checkOut")?.toString(),
    partySize: formData.get("partySize")?.toString(),
    budgetMin: formData.get("budgetMin")?.toString(),
    budgetMax: formData.get("budgetMax")?.toString(),
  });

  if (!raw.success) {
    return { status: "error", message: "Dados invalidos." };
  }

  const result = qualifyLead({
    name: raw.data.name,
    contact: raw.data.contact,
    checkIn: parseDate(raw.data.checkIn),
    checkOut: parseDate(raw.data.checkOut),
    partySize: parseNumber(raw.data.partySize),
    budgetMin: parseNumber(raw.data.budgetMin),
    budgetMax: parseNumber(raw.data.budgetMax),
  });

  return { status: "ok", result };
}
