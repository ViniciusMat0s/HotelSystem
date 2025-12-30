"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRoomAction,
  deleteRoomAction,
  updateRoomAction,
  type RoomActionState,
} from "@/actions/room";
import { ActionModal } from "@/components/action-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pill } from "@/components/cards";

type RoomItem = {
  id: string;
  number: string;
  name: string | null;
  floor: number | null;
  category: string;
  status: string;
  baseRate: string | null;
  maxGuests: number;
  features: string | null;
  notes: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponivel",
  OCCUPIED: "Ocupado",
  MAINTENANCE: "Manutencao",
  OUT_OF_SERVICE: "Fora de uso",
};

const CATEGORY_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  DELUXE: "Deluxe",
  SUITE: "Suite",
  FAMILY: "Familia",
  VILLA: "Villa",
  OTHER: "Outro",
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

const initialActionState: RoomActionState = { status: "idle" };

export function RoomsManager({ rooms }: { rooms: RoomItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoomItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [result, setResult] = useState<RoomActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Atualizacao");
  const [resultOpen, setResultOpen] = useState(false);

  const pendingDeleteRoom = useMemo(
    () => (confirmDeleteId ? rooms.find((room) => room.id === confirmDeleteId) ?? null : null),
    [confirmDeleteId, rooms]
  );

  const handleResult = (state: RoomActionState, title: string) => {
    setResult(state);
    setResultTitle(title);
    setResultOpen(true);
    router.refresh();
  };

  const handleDelete = (roomId: string) => {
    setConfirmDeleteId(roomId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      const response = await deleteRoomAction(confirmDeleteId);
      setConfirmDeleteId(null);
      handleResult(response, "Quarto excluido");
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg text-foreground">Gerenciar quartos</p>
          <p className="text-xs text-muted">Cadastre, edite e remova quartos.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn btn-primary btn-sm"
        >
          Novo quarto
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rooms.length === 0 ? (
          <p className="text-sm text-muted">Nenhum quarto cadastrado.</p>
        ) : (
          rooms.map((room) => {
            const statusLabel = STATUS_LABELS[room.status] ?? room.status;
            const statusTone =
              room.status === "AVAILABLE"
                ? "positive"
                : room.status === "OCCUPIED"
                ? "warning"
                : "critical";
            return (
              <div
                key={room.id}
                className="card-lite rounded-2xl border border-border bg-surface-strong p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg">Quarto {room.number}</p>
                  <Pill tone={statusTone}>{statusLabel}</Pill>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {CATEGORY_LABELS[room.category] ?? room.category}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                  <span>Andar: {room.floor ?? "--"}</span>
                  <span>Max: {room.maxGuests}</span>
                  <span>Diaria: {formatCurrency(room.baseRate)}</span>
                  <span>Nome: {room.name ?? "--"}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(room)}
                    className="btn btn-outline btn-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(room.id)}
                    className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isPending}
                  >
                    {isPending ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {createOpen ? (
        <RoomCreateModal
          onClose={() => setCreateOpen(false)}
          onResult={(state) => handleResult(state, "Quarto criado")}
        />
      ) : null}

      {editing ? (
        <RoomEditModal
          room={editing}
          onClose={() => setEditing(null)}
          onResult={(state) => handleResult(state, "Quarto atualizado")}
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
          pendingDeleteRoom
            ? `Excluir quarto ${pendingDeleteRoom.number}?`
            : "Deseja excluir este quarto?"
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

function RoomCreateModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (state: RoomActionState) => void;
}) {
  const [state, formAction] = useActionState(createRoomAction, initialActionState);

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
            <p className="font-display text-lg text-foreground">Novo quarto</p>
            <p className="text-xs text-muted">Cadastro rapido de acomodacao.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <RoomFormFields />
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Criar quarto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoomEditModal({
  room,
  onClose,
  onResult,
}: {
  room: RoomItem;
  onClose: () => void;
  onResult: (state: RoomActionState) => void;
}) {
  const [state, formAction] = useActionState(updateRoomAction, initialActionState);

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
            <p className="font-display text-lg text-foreground">Editar quarto</p>
            <p className="text-xs text-muted">Atualize dados da acomodacao.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <input type="hidden" name="roomId" value={room.id} />
          <RoomFormFields room={room} />
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

function RoomFormFields({ room }: { room?: RoomItem }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Numero
          </span>
          <input
            name="number"
            className="input-field"
            defaultValue={room?.number ?? ""}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Nome
          </span>
          <input
            name="name"
            className="input-field"
            defaultValue={room?.name ?? ""}
            placeholder="Suite Premium"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Andar
          </span>
          <input
            type="number"
            name="floor"
            min={0}
            className="input-field"
            defaultValue={room?.floor ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Categoria
          </span>
          <select
            name="category"
            className="input-field"
            defaultValue={room?.category ?? "STANDARD"}
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
            Status
          </span>
          <select
            name="status"
            className="input-field"
            defaultValue={room?.status ?? "AVAILABLE"}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Diaria (R$)
          </span>
          <input
            type="number"
            name="baseRate"
            step="0.01"
            min={0}
            className="input-field"
            defaultValue={room?.baseRate ?? ""}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Max hospedes
          </span>
          <input
            type="number"
            name="maxGuests"
            min={1}
            className="input-field"
            defaultValue={room?.maxGuests ?? 2}
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">
            Recursos
          </span>
          <input
            name="features"
            className="input-field"
            defaultValue={room?.features ?? ""}
            placeholder="Vista, varanda, etc."
          />
        </label>
      </div>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Observacoes
        </span>
        <textarea
          name="notes"
          className="input-field min-h-[110px] resize-none"
          defaultValue={room?.notes ?? ""}
        />
      </label>
    </>
  );
}
