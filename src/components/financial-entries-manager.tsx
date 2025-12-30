"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createFinancialEntryAction,
  deleteFinancialEntryAction,
  updateFinancialEntryAction,
  type FinancialEntryActionState,
} from "@/actions/financial-entry";
import { ActionModal } from "@/components/action-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pill } from "@/components/cards";

type FinancialEntryItem = {
  id: string;
  occurredAt: string;
  type: string;
  category: string;
  profitCenter: string;
  roomCategory: string | null;
  packageType: string | null;
  description: string | null;
  grossAmount: string | null;
  netAmount: string;
  taxAmount: string | null;
  currency: string;
  seasonType: string | null;
  source: string;
  reservationId: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  REVENUE: "Receita",
  EXPENSE: "Despesa",
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

const ROOM_CATEGORY_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  DELUXE: "Deluxe",
  SUITE: "Suite",
  FAMILY: "Familia",
  VILLA: "Villa",
  OTHER: "Outro",
};

const SEASON_LABELS: Record<string, string> = {
  HIGH: "Alta",
  LOW: "Baixa",
};

const SOURCE_LABELS: Record<string, string> = {
  RESERVATION: "Reserva",
  POS: "POS",
  INVOICE: "Fatura",
  MANUAL: "Manual",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
};

const formatDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatCurrency = (value: string | null) => {
  if (!value) return "--";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const initialActionState: FinancialEntryActionState = { status: "idle" };

export function FinancialEntriesManager({ entries }: { entries: FinancialEntryItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState<FinancialEntryItem | null>(null);
  const [editing, setEditing] = useState<FinancialEntryItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [result, setResult] = useState<FinancialEntryActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Atualizacao");
  const [resultOpen, setResultOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("date_desc");
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);

  const pendingDeleteEntry = useMemo(
    () =>
      confirmDeleteId
        ? entries.find((entry) => entry.id === confirmDeleteId) ?? null
        : null,
    [confirmDeleteId, entries]
  );

  const handleResult = (state: FinancialEntryActionState, title: string) => {
    setResult(state);
    setResultTitle(title);
    setResultOpen(true);
    router.refresh();
  };

  const handleDelete = (entryId: string) => {
    setConfirmDeleteId(entryId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      const response = await deleteFinancialEntryAction(confirmDeleteId);
      setConfirmDeleteId(null);
      handleResult(response, "Lancamento excluido");
    });
  };

  const handleDuplicate = (entry: FinancialEntryItem) => {
    setCreateSeed({
      ...entry,
      occurredAt: new Date().toISOString(),
      source: "MANUAL",
      reservationId: null,
    });
    setCreateOpen(true);
  };

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "all" && entry.type !== typeFilter) return false;
      if (sourceFilter !== "all" && entry.source !== sourceFilter) return false;
      if (centerFilter !== "all" && entry.profitCenter !== centerFilter) return false;
      if (!query) return true;
      const haystack = [
        entry.description ?? "",
        entry.packageType ?? "",
        entry.reservationId ?? "",
        entry.category,
        entry.profitCenter,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, search, typeFilter, sourceFilter, centerFilter]);

  const sortedEntries = useMemo(() => {
    const list = [...filteredEntries];
    list.sort((a, b) => {
      const dateA = new Date(a.occurredAt).getTime();
      const dateB = new Date(b.occurredAt).getTime();
      const amountA = Number(a.netAmount ?? 0);
      const amountB = Number(b.netAmount ?? 0);
      if (sortOrder === "date_asc") return dateA - dateB;
      if (sortOrder === "amount_desc") return amountB - amountA;
      if (sortOrder === "amount_asc") return amountA - amountB;
      return dateB - dateA;
    });
    return list;
  }, [filteredEntries, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedEntries.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedEntries]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg text-foreground">Lancamentos financeiros</p>
          <p className="text-xs text-muted">
            Registre consumo, ajustes e receitas/despesas manuais.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateSeed(null);
            setCreateOpen(true);
          }}
          className="btn btn-primary btn-sm"
        >
          Novo lancamento
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
              placeholder="Descricao, pacote ou reserva"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Tipo
            </span>
            <select
              className="input-field"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Fonte
            </span>
            <select
              className="input-field"
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todas</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
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
              className="input-field"
              value={centerFilter}
              onChange={(event) => {
                setCenterFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              {Object.entries(PROFIT_CENTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>{sortedEntries.length} lancamentos encontrados</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>Ordenar</span>
              <select
                className="input-field w-[160px]"
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value);
                  setPage(1);
                }}
              >
                <option value="date_desc">Data recente</option>
                <option value="date_asc">Data antiga</option>
                <option value="amount_desc">Maior valor</option>
                <option value="amount_asc">Menor valor</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span>Por pagina</span>
              <select
                className="input-field w-[90px]"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[8, 12, 20].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
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

        {sortedEntries.length === 0 ? (
          <p className="text-sm text-muted">Nenhum lancamento encontrado.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {paginatedEntries.map((entry) => {
              const typeLabel = TYPE_LABELS[entry.type] ?? entry.type;
              const sourceLabel = SOURCE_LABELS[entry.source] ?? entry.source;
              const typeTone = entry.type === "REVENUE" ? "positive" : "critical";
              return (
                <div
                  key={entry.id}
                  className="card-lite rounded-2xl border border-border bg-surface-strong p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display text-base text-foreground">
                        {entry.description || "Lancamento sem descricao"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(entry.occurredAt)} •{" "}
                        {CATEGORY_LABELS[entry.category] ?? entry.category} •{" "}
                        {PROFIT_CENTER_LABELS[entry.profitCenter] ?? entry.profitCenter}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={typeTone}>{typeLabel}</Pill>
                      <span className="rounded-full bg-surface-strong px-2 py-1 text-xs text-muted">
                        {sourceLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                    <span>
                      Valor: {formatCurrency(entry.netAmount)}
                      {entry.roomCategory
                        ? ` • ${ROOM_CATEGORY_LABELS[entry.roomCategory] ?? entry.roomCategory}`
                        : ""}
                      {entry.packageType ? ` • Pacote: ${entry.packageType}` : ""}
                      {entry.seasonType
                        ? ` • Temporada: ${SEASON_LABELS[entry.seasonType] ?? entry.seasonType}`
                        : ""}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(entry)}
                        className="btn btn-outline btn-sm"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(entry)}
                        className="btn btn-ghost btn-sm"
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isPending}
                      >
                        {isPending ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                  {entry.reservationId ? (
                    <p className="mt-2 text-xs text-muted">
                      Reserva vinculada: {entry.reservationId}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createOpen ? (
        <FinancialEntryCreateModal
          seed={createSeed ?? undefined}
          onClose={() => {
            setCreateOpen(false);
            setCreateSeed(null);
          }}
          onResult={(state) => handleResult(state, "Lancamento criado")}
        />
      ) : null}

      {editing ? (
        <FinancialEntryEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onResult={(state) => handleResult(state, "Lancamento atualizado")}
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
        open={Boolean(confirmDeleteId)}
        tone="danger"
        title="Confirmar exclusao"
        description={
          pendingDeleteEntry
            ? `Excluir lancamento de ${formatCurrency(pendingDeleteEntry.netAmount)}?`
            : "Deseja excluir este lancamento?"
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

function FinancialEntryCreateModal({
  seed,
  onClose,
  onResult,
}: {
  seed?: FinancialEntryItem;
  onClose: () => void;
  onResult: (state: FinancialEntryActionState) => void;
}) {
  const [state, formAction] = useActionState(
    createFinancialEntryAction,
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
            <p className="font-display text-lg text-foreground">Novo lancamento</p>
            <p className="text-xs text-muted">
              Receita ou despesa registrada manualmente.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <FinancialEntryFormFields entry={seed} />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Criar lancamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FinancialEntryEditModal({
  entry,
  onClose,
  onResult,
}: {
  entry: FinancialEntryItem;
  onClose: () => void;
  onResult: (state: FinancialEntryActionState) => void;
}) {
  const [state, formAction] = useActionState(
    updateFinancialEntryAction,
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
            <p className="font-display text-lg text-foreground">Editar lancamento</p>
            <p className="text-xs text-muted">
              Ajuste valores e categorizacao.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <input type="hidden" name="entryId" value={entry.id} />
          <FinancialEntryFormFields entry={entry} />
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

function FinancialEntryFormFields({ entry }: { entry?: FinancialEntryItem }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Data
          </span>
          <input
            type="date"
            name="occurredAt"
            className="input-field"
            defaultValue={formatDateInput(entry?.occurredAt)}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Tipo
          </span>
          <select
            name="type"
            className="input-field"
            defaultValue={entry?.type ?? "REVENUE"}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Fonte
          </span>
          <select
            name="source"
            className="input-field"
            defaultValue={entry?.source ?? "MANUAL"}
          >
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
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
            defaultValue={entry?.profitCenter ?? "OTHER"}
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
            Categoria
          </span>
          <select
            name="category"
            className="input-field"
            defaultValue={entry?.category ?? "OTHER"}
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
            Tipo de quarto
          </span>
          <select
            name="roomCategory"
            className="input-field"
            defaultValue={entry?.roomCategory ?? ""}
          >
            <option value="">Sem categoria</option>
            {Object.entries(ROOM_CATEGORY_LABELS).map(([value, label]) => (
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
            defaultValue={entry?.seasonType ?? ""}
          >
            <option value="">Sem temporada</option>
            {Object.entries(SEASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Pacote
          </span>
          <input
            name="packageType"
            className="input-field"
            defaultValue={entry?.packageType ?? ""}
            placeholder="Romance, premium, etc."
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Reserva (opcional)
          </span>
          <input
            name="reservationId"
            className="input-field"
            defaultValue={entry?.reservationId ?? ""}
            placeholder="ID da reserva"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Valor liquido
          </span>
          <input
            type="number"
            name="netAmount"
            step="0.01"
            className="input-field"
            defaultValue={entry?.netAmount ?? ""}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Valor bruto
          </span>
          <input
            type="number"
            name="grossAmount"
            step="0.01"
            className="input-field"
            defaultValue={entry?.grossAmount ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Impostos
          </span>
          <input
            type="number"
            name="taxAmount"
            step="0.01"
            className="input-field"
            defaultValue={entry?.taxAmount ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Moeda
          </span>
          <input
            name="currency"
            className="input-field"
            defaultValue={entry?.currency ?? "BRL"}
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
          defaultValue={entry?.description ?? ""}
          placeholder="Detalhes do lancamento"
        />
      </label>
    </>
  );
}
