"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGuestAction,
  deleteGuestAction,
  updateGuestAction,
  type GuestActionState,
} from "@/actions/guest";
import { ActionModal } from "@/components/action-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pill } from "@/components/cards";

type GuestItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentId: string | null;
  nationality: string | null;
  marketingOptIn: boolean;
  profileNote: string | null;
  difficultyScore: number;
};

const initialActionState: GuestActionState = { status: "idle" };

export function GuestsManager({ guests }: { guests: GuestItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GuestItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [result, setResult] = useState<GuestActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Atualizacao");
  const [resultOpen, setResultOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);

  const pendingDeleteGuest = useMemo(
    () => (confirmDeleteId ? guests.find((guest) => guest.id === confirmDeleteId) ?? null : null),
    [confirmDeleteId, guests]
  );

  const handleResult = (state: GuestActionState, title: string) => {
    setResult(state);
    setResultTitle(title);
    setResultOpen(true);
    router.refresh();
  };

  const handleDelete = (guestId: string) => {
    setConfirmDeleteId(guestId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      const response = await deleteGuestAction(confirmDeleteId);
      setConfirmDeleteId(null);
      handleResult(response, "Hospede excluido");
    });
  };

  const filteredGuests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guests;
    return guests.filter((guest) => {
      const haystack = [
        guest.firstName,
        guest.lastName,
        guest.email ?? "",
        guest.phone ?? "",
        guest.documentId ?? "",
        guest.nationality ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [guests, search]);

  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedGuests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGuests.slice(start, start + pageSize);
  }, [currentPage, filteredGuests, pageSize]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg text-foreground">Hospedes</p>
          <p className="text-xs text-muted">Base completa e dados de perfil.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn btn-primary btn-sm"
        >
          Novo hospede
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
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
              placeholder="Nome, email, telefone ou documento"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>{filteredGuests.length} hospedes encontrados</span>
          <div className="flex items-center gap-2">
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

        {filteredGuests.length === 0 ? (
          <p className="text-sm text-muted">Nenhum hospede encontrado.</p>
        ) : (
          <div className="space-y-2">
            {paginatedGuests.map((guest) => {
              const scoreTone =
                guest.difficultyScore >= 7
                  ? "critical"
                  : guest.difficultyScore >= 4
                  ? "warning"
                  : "positive";
              return (
                <div
                  key={guest.id}
                  className="card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3 text-[13px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display text-sm text-foreground">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        {guest.email ?? "Email nao informado"}{" "}
                        {guest.phone ? `- ${guest.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {guest.marketingOptIn ? (
                        <Pill tone="positive">Opt-in</Pill>
                      ) : (
                        <Pill tone="neutral">Sem opt-in</Pill>
                      )}
                      <Pill tone={scoreTone}>Score {guest.difficultyScore}</Pill>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                    <span>
                      Documento: {guest.documentId ?? "--"} - {guest.nationality ?? "--"}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(guest)}
                        className="btn btn-outline btn-sm"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(guest.id)}
                        className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isPending}
                      >
                        {isPending ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createOpen ? (
        <GuestCreateModal
          onClose={() => setCreateOpen(false)}
          onResult={(state) => handleResult(state, "Hospede criado")}
        />
      ) : null}

      {editing ? (
        <GuestEditModal
          guest={editing}
          onClose={() => setEditing(null)}
          onResult={(state) => handleResult(state, "Hospede atualizado")}
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
          pendingDeleteGuest
            ? `Excluir hospede ${pendingDeleteGuest.firstName} ${pendingDeleteGuest.lastName}?`
            : "Deseja excluir este hospede?"
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

function GuestCreateModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (state: GuestActionState) => void;
}) {
  const [state, formAction] = useActionState(createGuestAction, initialActionState);

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
        className="panel-strong w-full max-w-2xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Novo hospede</p>
            <p className="text-xs text-muted">Cadastre um novo cliente.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <GuestFormFields />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Criar hospede
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GuestEditModal({
  guest,
  onClose,
  onResult,
}: {
  guest: GuestItem;
  onClose: () => void;
  onResult: (state: GuestActionState) => void;
}) {
  const [state, formAction] = useActionState(updateGuestAction, initialActionState);

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
        className="panel-strong w-full max-w-2xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Editar hospede</p>
            <p className="text-xs text-muted">Atualize dados do perfil.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <input type="hidden" name="guestId" value={guest.id} />
          <GuestFormFields guest={guest} />
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

function GuestFormFields({ guest }: { guest?: GuestItem }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Nome
          </span>
          <input
            name="firstName"
            className="input-field"
            defaultValue={guest?.firstName ?? ""}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Sobrenome
          </span>
          <input
            name="lastName"
            className="input-field"
            defaultValue={guest?.lastName ?? ""}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Email
          </span>
          <input
            name="email"
            type="email"
            className="input-field"
            defaultValue={guest?.email ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Telefone
          </span>
          <input
            name="phone"
            className="input-field"
            defaultValue={guest?.phone ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Documento
          </span>
          <input
            name="documentId"
            className="input-field"
            defaultValue={guest?.documentId ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Nacionalidade
          </span>
          <input
            name="nationality"
            className="input-field"
            defaultValue={guest?.nationality ?? ""}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong px-4 py-3 text-xs text-muted">
          <input
            type="checkbox"
            name="marketingOptIn"
            defaultChecked={guest?.marketingOptIn ?? false}
            className="h-4 w-4 accent-primary"
          />
          Opt-in de marketing
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Score (0-10)
          </span>
          <input
            type="number"
            name="difficultyScore"
            min={0}
            max={10}
            className="input-field"
            defaultValue={guest?.difficultyScore ?? 0}
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Observacoes
        </span>
        <textarea
          name="profileNote"
          className="input-field min-h-[110px] resize-none"
          defaultValue={guest?.profileNote ?? ""}
        />
      </label>
    </>
  );
}
