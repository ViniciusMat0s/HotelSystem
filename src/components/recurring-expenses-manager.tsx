"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRecurringExpenseAction,
  deleteRecurringExpenseAction,
  runRecurringExpensesAction,
  updateRecurringExpenseAction,
  type RecurringExpenseActionState,
} from "@/actions/recurring-expense";
import { ActionModal } from "@/components/action-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pill } from "@/components/cards";

type RecurringExpenseItem = {
  id: string;
  name: string;
  provider: string;
  description: string | null;
  amount: string;
  currency: string;
  category: string;
  profitCenter: string;
  seasonType: string | null;
  frequency: string;
  interval: number;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
};

const PROVIDER_LABELS: Record<string, string> = {
  WATER: "Agua",
  POWER: "Energia",
  INTERNET: "Internet",
  TV: "TV",
  OTHER: "Outros",
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

const CATEGORY_LABELS: Record<string, string> = {
  ROOM: "Quarto",
  PACKAGE: "Pacote",
  FOOD_BEVERAGE: "Alimentos/Bebidas",
  OTHER: "Outros",
};

const PROFIT_CENTER_LABELS: Record<string, string> = {
  ROOM: "Hospedagem",
  PACKAGE: "Pacotes",
  CONSUMPTION: "Consumo",
  OTHER: "Outros",
};

const SEASON_LABELS: Record<string, string> = {
  HIGH: "Alta",
  LOW: "Baixa",
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
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

const formatDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const initialActionState: RecurringExpenseActionState = { status: "idle" };

export function RecurringExpensesManager({
  items,
}: {
  items: RecurringExpenseItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpenseItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [result, setResult] = useState<RecurringExpenseActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Atualizacao");
  const [resultOpen, setResultOpen] = useState(false);
  const [runResult, setRunResult] = useState<RecurringExpenseActionState | null>(
    null
  );
  const [runOpen, setRunOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(6);
  const [page, setPage] = useState(1);

  const pendingDelete = useMemo(
    () =>
      confirmDeleteId
        ? items.find((item) => item.id === confirmDeleteId) ?? null
        : null,
    [confirmDeleteId, items]
  );

  const handleResult = (state: RecurringExpenseActionState, title: string) => {
    setResult(state);
    setResultTitle(title);
    setResultOpen(true);
    router.refresh();
  };

  const handleDelete = (recurringExpenseId: string) => {
    setConfirmDeleteId(recurringExpenseId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      const response = await deleteRecurringExpenseAction(confirmDeleteId);
      setConfirmDeleteId(null);
      handleResult(response, "Recorrencia excluida");
    });
  };

  const handleRunNow = () => {
    startTransition(async () => {
      const response = await runRecurringExpensesAction();
      setRunResult(response);
      setRunOpen(true);
      router.refresh();
    });
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "active" && !item.active) return false;
      if (statusFilter === "inactive" && item.active) return false;
      if (!query) return true;
      const haystack = [
        item.name,
        item.description ?? "",
        item.provider,
        item.category,
        item.profitCenter,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [currentPage, filteredItems, pageSize]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg text-foreground">Despesas recorrentes</p>
          <p className="text-xs text-muted">
            Gere lancamentos automaticos para contas fixas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunNow}
            className="btn btn-outline btn-sm"
            disabled={isPending}
          >
            {isPending ? "Processando..." : "Executar agora"}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn btn-primary btn-sm"
          >
            Nova recorrencia
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
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
              placeholder="Nome, fornecedor ou descricao"
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
              <option value="active">Ativas</option>
              <option value="inactive">Pausadas</option>
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

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>{filteredItems.length} recorrencias encontradas</span>
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

        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma recorrencia cadastrada.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {paginatedItems.map((item) => {
              const providerLabel = PROVIDER_LABELS[item.provider] ?? item.provider;
              const frequencyLabel =
                FREQUENCY_LABELS[item.frequency] ?? item.frequency;
              const tone = item.active ? "positive" : "warning";
              return (
                <div
                  key={item.id}
                  className="card-lite rounded-2xl border border-border bg-surface-strong p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display text-base text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted">
                        {providerLabel} • {formatCurrency(item.amount)}
                      </p>
                    </div>
                    <Pill tone={tone}>{item.active ? "Ativa" : "Pausada"}</Pill>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-muted">
                    <p>
                      Frequencia: {frequencyLabel} (x{item.interval})
                    </p>
                    <p>
                      Proxima execucao: {formatDate(item.nextRunAt)} • Ultima:{" "}
                      {formatDate(item.lastRunAt)}
                    </p>
                    <p>
                      Categoria: {CATEGORY_LABELS[item.category] ?? item.category} •{" "}
                      Centro:{" "}
                      {PROFIT_CENTER_LABELS[item.profitCenter] ?? item.profitCenter}
                      {item.seasonType
                        ? ` • Temporada ${SEASON_LABELS[item.seasonType] ?? item.seasonType}`
                        : ""}
                    </p>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="btn btn-outline btn-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending}
                    >
                      {isPending ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createOpen ? (
        <RecurringExpenseCreateModal
          onClose={() => setCreateOpen(false)}
          onResult={(state) => handleResult(state, "Recorrencia criada")}
        />
      ) : null}

      {editing ? (
        <RecurringExpenseEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onResult={(state) => handleResult(state, "Recorrencia atualizada")}
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

      <ActionModal
        open={runOpen && Boolean(runResult)}
        tone={runResult?.status === "error" ? "error" : "success"}
        title="Recorrencias processadas"
        description={runResult?.message}
        onClose={() => setRunOpen(false)}
        actionLabel="Ok, entendi"
      />

      <ConfirmModal
        open={Boolean(confirmDeleteId)}
        tone="danger"
        title="Confirmar exclusao"
        description={
          pendingDelete
            ? `Excluir recorrencia ${pendingDelete.name}?`
            : "Deseja excluir esta recorrencia?"
        }
        confirmLabel="Sim, excluir"
        cancelLabel="Voltar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
        isBusy={isPending}
      />
    </>
  );
}

function RecurringExpenseCreateModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (state: RecurringExpenseActionState) => void;
}) {
  const [state, formAction] = useActionState(
    createRecurringExpenseAction,
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
        className="panel-strong w-full max-w-3xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Nova recorrencia</p>
            <p className="text-xs text-muted">
              Automatize despesas mensais e trimestrais.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <RecurringExpenseFormFields />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Criar recorrencia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecurringExpenseEditModal({
  item,
  onClose,
  onResult,
}: {
  item: RecurringExpenseItem;
  onClose: () => void;
  onResult: (state: RecurringExpenseActionState) => void;
}) {
  const [state, formAction] = useActionState(
    updateRecurringExpenseAction,
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
        className="panel-strong w-full max-w-3xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Editar recorrencia</p>
            <p className="text-xs text-muted">Atualize o agendamento.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <input type="hidden" name="recurringExpenseId" value={item.id} />
          <RecurringExpenseFormFields item={item} />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar alteracoes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecurringExpenseFormFields({ item }: { item?: RecurringExpenseItem }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Nome
          </span>
          <input
            name="name"
            className="input-field"
            defaultValue={item?.name ?? ""}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Fornecedor
          </span>
          <select
            name="provider"
            className="input-field"
            defaultValue={item?.provider ?? "OTHER"}
          >
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Valor
          </span>
          <input
            type="number"
            name="amount"
            step="0.01"
            className="input-field"
            defaultValue={item?.amount ?? ""}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Moeda
          </span>
          <input
            name="currency"
            className="input-field"
            defaultValue={item?.currency ?? "BRL"}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Categoria
          </span>
          <select
            name="category"
            className="input-field"
            defaultValue={item?.category ?? "OTHER"}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Centro
          </span>
          <select
            name="profitCenter"
            className="input-field"
            defaultValue={item?.profitCenter ?? "OTHER"}
          >
            {Object.entries(PROFIT_CENTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Temporada
          </span>
          <select
            name="seasonType"
            className="input-field"
            defaultValue={item?.seasonType ?? ""}
          >
            <option value="">Sem temporada</option>
            {Object.entries(SEASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Frequencia
          </span>
          <select
            name="frequency"
            className="input-field"
            defaultValue={item?.frequency ?? "MONTHLY"}
          >
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Intervalo
          </span>
          <input
            type="number"
            name="interval"
            min={1}
            className="input-field"
            defaultValue={item?.interval ?? 1}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Proxima execucao
          </span>
          <input
            type="date"
            name="nextRunAt"
            className="input-field"
            defaultValue={formatDateInput(item?.nextRunAt)}
            required
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Descricao
        </span>
        <textarea
          name="description"
          className="input-field min-h-[110px] resize-none"
          defaultValue={item?.description ?? ""}
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-3 text-xs text-muted">
        <input
          type="checkbox"
          name="active"
          defaultChecked={item?.active ?? true}
          className="h-4 w-4 accent-primary"
        />
        Recorrencia ativa
      </label>
    </>
  );
}
