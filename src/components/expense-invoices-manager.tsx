"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveExpenseInvoiceAction,
  cancelExpenseInvoiceAction,
  markExpenseInvoicePaidAction,
  updateExpenseInvoiceNotesAction,
  type ExpenseInvoiceActionState,
} from "@/actions/expense-invoice";
import { ActionModal } from "@/components/action-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pill } from "@/components/cards";

type InvoiceAuditItem = {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actor: string | null;
  createdAt: string;
};

type ExpenseInvoiceItem = {
  id: string;
  provider: string;
  invoiceNumber: string | null;
  amount: string;
  currency: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  dueDate: string | null;
  receivedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  status: string;
  notes: string | null;
  hasEntry: boolean;
  audits: InvoiceAuditItem[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PAID: "Pago",
  CANCELED: "Cancelado",
};

const PROVIDER_LABELS: Record<string, string> = {
  WATER: "Agua",
  POWER: "Energia",
  INTERNET: "Internet",
  TV: "TV",
  OTHER: "Outros",
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR");
};

const formatCurrency = (value: string) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * MS_PER_DAY);

const toNormalizedDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return normalizeDate(date);
};

const parseInputDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return normalizeDate(date);
};

const isOpenStatus = (status: string) => status !== "PAID" && status !== "CANCELED";

const initialActionState: ExpenseInvoiceActionState = { status: "idle" };

export function ExpenseInvoicesManager({
  invoices,
}: {
  invoices: ExpenseInvoiceItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ExpenseInvoiceActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Atualizacao");
  const [resultOpen, setResultOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [pageSize, setPageSize] = useState(6);
  const [page, setPage] = useState(1);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [notesInvoice, setNotesInvoice] = useState<ExpenseInvoiceItem | null>(
    null
  );
  const [historyInvoice, setHistoryInvoice] = useState<ExpenseInvoiceItem | null>(
    null
  );

  const pendingCancel = useMemo(
    () =>
      confirmCancelId
        ? invoices.find((invoice) => invoice.id === confirmCancelId) ?? null
        : null,
    [confirmCancelId, invoices]
  );

  const handleResult = (state: ExpenseInvoiceActionState, title: string) => {
    setResult(state);
    setResultTitle(title);
    setResultOpen(true);
    router.refresh();
  };

  const overdueSummary = useMemo(() => {
    const today = normalizeDate(new Date());
    return invoices.reduce(
      (acc, invoice) => {
        if (!isOpenStatus(invoice.status)) return acc;
        const dueDate = toNormalizedDate(invoice.dueDate);
        if (!dueDate || dueDate >= today) return acc;
        acc.count += 1;
        const amount = Number(invoice.amount);
        if (!Number.isNaN(amount)) {
          acc.total += amount;
        }
        return acc;
      },
      { count: 0, total: 0 }
    );
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = normalizeDate(new Date());
    const soonLimit = addDays(today, 7);
    const dueFromDate = parseInputDate(dueFrom);
    const dueToDate = parseInputDate(dueTo);
    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
      const dueDate = toNormalizedDate(invoice.dueDate);
      if (dueFilter !== "all") {
        if (dueFilter === "overdue") {
          if (!dueDate || !isOpenStatus(invoice.status) || dueDate >= today) {
            return false;
          }
        } else if (dueFilter === "today") {
          if (
            !dueDate ||
            !isOpenStatus(invoice.status) ||
            dueDate.getTime() !== today.getTime()
          ) {
            return false;
          }
        } else if (dueFilter === "next7") {
          if (
            !dueDate ||
            !isOpenStatus(invoice.status) ||
            dueDate <= today ||
            dueDate > soonLimit
          ) {
            return false;
          }
        } else if (dueFilter === "nodue") {
          if (dueDate) return false;
        }
      }
      if (dueFromDate || dueToDate) {
        if (!dueDate) return false;
        if (dueFromDate && dueDate < dueFromDate) return false;
        if (dueToDate && dueDate > dueToDate) return false;
      }
      if (!query) return true;
      const haystack = [
        invoice.invoiceNumber ?? "",
        invoice.provider,
        invoice.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [invoices, search, statusFilter, dueFilter, dueFrom, dueTo]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [currentPage, filteredInvoices, pageSize]);

  const handleApprove = (invoiceId: string) => {
    startTransition(async () => {
      const response = await approveExpenseInvoiceAction(invoiceId);
      handleResult(response, "Fatura aprovada");
    });
  };

  const handlePaid = (invoiceId: string) => {
    startTransition(async () => {
      const response = await markExpenseInvoicePaidAction(invoiceId);
      handleResult(response, "Fatura paga");
    });
  };

  const handleCancel = (invoiceId: string) => {
    setConfirmCancelId(invoiceId);
  };

  const confirmCancel = () => {
    if (!confirmCancelId) return;
    startTransition(async () => {
      const response = await cancelExpenseInvoiceAction(confirmCancelId);
      setConfirmCancelId(null);
      handleResult(response, "Fatura cancelada");
    });
  };

  const today = normalizeDate(new Date());

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Buscar
            </span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="input-field"
              placeholder="Numero, fornecedor ou notas"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Status
            </span>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Por pagina
            </span>
            <select
              className="input-field"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[6, 10, 16].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Vencimento
            </span>
            <select
              className="input-field"
              value={dueFilter}
              onChange={(event) => {
                setDueFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              <option value="overdue">Atrasadas</option>
              <option value="today">Vencem hoje</option>
              <option value="next7">Proximos 7 dias</option>
              <option value="nodue">Sem vencimento</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Data de
            </span>
            <input
              type="date"
              className="input-field"
              value={dueFrom}
              onChange={(event) => {
                setDueFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Data ate
            </span>
            <input
              type="date"
              className="input-field"
              value={dueTo}
              onChange={(event) => {
                setDueTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        {overdueSummary.count > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary">
                Atrasos detectados
              </p>
              <p className="mt-1 text-sm text-muted">
                {overdueSummary.count} faturas em atraso somando{" "}
                {formatCurrency(overdueSummary.total.toFixed(2))}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setDueFilter("overdue");
                setDueFrom("");
                setDueTo("");
                setPage(1);
              }}
            >
              Ver atrasadas
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>{filteredInvoices.length} faturas encontradas</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              Anterior
            </button>
            <span>
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Proxima
            </button>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma fatura encontrada. Conecte o email financeiro.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {paginatedInvoices.map((invoice) => {
              const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;
              const statusTone =
                invoice.status === "PAID"
                  ? "positive"
                  : invoice.status === "CANCELED"
                  ? "critical"
                  : invoice.status === "APPROVED"
                  ? "neutral"
                  : "warning";
              const providerLabel =
                PROVIDER_LABELS[invoice.provider] ?? invoice.provider;
              const periodLabel =
                invoice.billingPeriodStart && invoice.billingPeriodEnd
                  ? `${formatDate(invoice.billingPeriodStart)} - ${formatDate(
                      invoice.billingPeriodEnd
                    )}`
                  : null;
              const dueDate = toNormalizedDate(invoice.dueDate);
              const dueDiff =
                dueDate && isOpenStatus(invoice.status)
                  ? Math.round((dueDate.getTime() - today.getTime()) / MS_PER_DAY)
                  : null;
              const dueBadge =
                dueDiff === null
                  ? null
                  : dueDiff < 0
                  ? {
                      label: `Atrasada ha ${Math.abs(dueDiff)} dia${
                        Math.abs(dueDiff) === 1 ? "" : "s"
                      }`,
                      tone: "critical" as const,
                    }
                  : dueDiff === 0
                  ? { label: "Vence hoje", tone: "warning" as const }
                  : dueDiff <= 7
                  ? {
                      label: `Vence em ${dueDiff} dia${dueDiff === 1 ? "" : "s"}`,
                      tone: "warning" as const,
                    }
                  : null;
              const lastAudit = invoice.audits[0];
              return (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-4 card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-base text-foreground">
                        {providerLabel}
                      </p>
                      <Pill tone={statusTone}>{statusLabel}</Pill>
                      {invoice.hasEntry ? (
                        <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs text-secondary">
                          Conciliada
                        </span>
                      ) : null}
                      {dueBadge ? (
                        <Pill tone={dueBadge.tone}>{dueBadge.label}</Pill>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {invoice.invoiceNumber
                        ? `Fatura ${invoice.invoiceNumber}`
                        : "Fatura sem numero"}
                      {" | "}
                      Recebida: {formatDate(invoice.receivedAt)}
                      {" | "}
                      Vencimento: {formatDate(invoice.dueDate)}
                      {periodLabel ? ` | Periodo: ${periodLabel}` : ""}
                    </p>
                    {invoice.notes ? (
                      <p className="mt-1 text-xs text-muted">
                        Notas: {invoice.notes}
                      </p>
                    ) : null}
                    {lastAudit ? (
                      <p className="mt-1 text-xs text-muted">
                        Ultima alteracao: {lastAudit.action} em{" "}
                        {formatDateTime(lastAudit.createdAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg">
                      {formatCurrency(invoice.amount)}
                    </span>
                    {invoice.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => handleApprove(invoice.id)}
                        className="btn btn-outline btn-sm"
                        disabled={isPending}
                      >
                        Aprovar
                      </button>
                    ) : null}
                    {invoice.status !== "PAID" && invoice.status !== "CANCELED" ? (
                      <button
                        type="button"
                        onClick={() => handlePaid(invoice.id)}
                        className="btn btn-primary btn-sm"
                        disabled={isPending}
                      >
                        Marcar pago
                      </button>
                    ) : null}
                    {invoice.status !== "CANCELED" && invoice.status !== "PAID" ? (
                      <button
                        type="button"
                        onClick={() => handleCancel(invoice.id)}
                        className="btn btn-ghost btn-sm"
                        disabled={isPending}
                      >
                        Cancelar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setNotesInvoice(invoice)}
                      className="btn btn-ghost btn-sm"
                    >
                      Notas
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryInvoice(invoice)}
                      className="btn btn-ghost btn-sm"
                      disabled={invoice.audits.length === 0}
                    >
                      Historico
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {notesInvoice ? (
        <InvoiceNotesModal
          invoice={notesInvoice}
          onClose={() => setNotesInvoice(null)}
          onResult={(state) => handleResult(state, "Notas atualizadas")}
        />
      ) : null}

      {historyInvoice ? (
        <InvoiceHistoryModal
          invoice={historyInvoice}
          onClose={() => setHistoryInvoice(null)}
        />
      ) : null}

      <ActionModal
        open={resultOpen && Boolean(result)}
        tone={result?.status === "error" ? "error" : "success"}
        title={resultTitle}
        description={result?.message}
        onClose={() => setResultOpen(false)}
        actionLabel="Ok, entendi"
      />

      <ConfirmModal
        open={Boolean(confirmCancelId)}
        tone="danger"
        title="Confirmar cancelamento"
        description={
          pendingCancel
            ? `Cancelar fatura ${pendingCancel.invoiceNumber ?? pendingCancel.id}?`
            : "Deseja cancelar esta fatura?"
        }
        confirmLabel="Sim, cancelar"
        cancelLabel="Voltar"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmCancelId(null)}
        isBusy={isPending}
      />
    </>
  );
}

function InvoiceNotesModal({
  invoice,
  onClose,
  onResult,
}: {
  invoice: ExpenseInvoiceItem;
  onClose: () => void;
  onResult: (state: ExpenseInvoiceActionState) => void;
}) {
  const [state, formAction] = useActionState(
    updateExpenseInvoiceNotesAction,
    initialActionState
  );

  useEffect(() => {
    if (state.status === "idle") return;
    onResult(state);
    if (state.status === "ok") {
      onClose();
    }
  }, [state, onClose, onResult]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="panel-strong w-full max-w-xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Notas internas</p>
            <p className="text-xs text-muted">
              {invoice.invoiceNumber
                ? `Fatura ${invoice.invoiceNumber}`
                : "Fatura sem numero"}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Notas
            </span>
            <textarea
              name="notes"
              className="input-field min-h-[110px] resize-none"
              defaultValue={invoice.notes ?? ""}
            />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar notas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceHistoryModal({
  invoice,
  onClose,
}: {
  invoice: ExpenseInvoiceItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="panel-strong w-full max-w-xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Historico</p>
            <p className="text-xs text-muted">
              {invoice.invoiceNumber
                ? `Fatura ${invoice.invoiceNumber}`
                : "Fatura sem numero"}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          {invoice.audits.length === 0 ? (
            <p className="text-xs text-muted">Sem historico registrado.</p>
          ) : (
            invoice.audits.map((audit) => (
              <div
                key={audit.id}
                className="rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{audit.action}</span>
                  <span>{formatDateTime(audit.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {audit.fromStatus ? STATUS_LABELS[audit.fromStatus] ?? audit.fromStatus : "--"}
                  {" -> "}
                  {audit.toStatus ? STATUS_LABELS[audit.toStatus] ?? audit.toStatus : "--"}
                  {audit.actor ? ` | ${audit.actor}` : ""}
                </p>
                {audit.note ? (
                  <p className="mt-1 text-xs text-muted">{audit.note}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


