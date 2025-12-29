import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestExpenseInvoiceFromEmail } from "@/lib/automation";

const PayloadSchema = z.object({
  emailText: z.string().min(10),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 }
    );
  }

  const invoice = await ingestExpenseInvoiceFromEmail(parsed.data.emailText);
  if (!invoice) {
    return NextResponse.json(
      { ok: false, message: "Nao foi possivel extrair dados." },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, invoice });
}
