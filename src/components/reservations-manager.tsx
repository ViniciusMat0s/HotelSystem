"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelReservationAction,
  updateReservationAction,
  type ReservationActionState,
} from "@/actions/reservation";
import { ActionModal } from "@/components/action-modal";
import { Pill } from "@/components/cards";

type ReservationItem = {
  id: string;
  checkIn: string;
  checkOut: string;
  status: string;
  paymentStatus: string;
  source: string;
  roomId: string | null;
  roomCategory: string;
  adults: number;
  children: number;
  totalAmount: string | null;
  packageType: string | null;
  seasonType: string | null;
  notes: string | null;
  guest: {
    firstName: string;
    lastName: string;
  };
  room: {
    id: string;
    number: string;
    category: string;
  } | null;
};

type RoomOption = {
  id: string;
  number: string;
  status: string;
  category: string;
};

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Reservada",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  CANCELED: "Cancelada",
  NO_SHOW: "No-show",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  PARTIAL: "Parcial",
  REFUNDED: "Reembolsado",
  FAILED: "Falhou",
};

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Direto",
  BOOKING: "Booking.com",
  WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in",
  OTA: "OTA",
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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
};

const formatDateInput = (value: string) => {
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

const initialActionState: ReservationActionState = { status: "idle" };

export function ReservationsManager({
  reservations,
  rooms,
}: {
  reservations: ReservationItem[];
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ReservationItem | null>(null);
  const [result, setResult] = useState<ReservationActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Atualizacao");
  const [resultOpen, setResultOpen] = useState(false);

  const roomOptions = useMemo(
    () =>
      rooms.map((room) => ({
        value: room.id,
        label: `${room.number} - ${ROOM_CATEGORY_LABELS[room.category] ?? room.category}`,
        status: room.status,
        category: room.category,
      })),
    [rooms]
  );

  const handleResult = (state: ReservationActionState, title: string) => {
    setResult(state);
    setResultTitle(title);
    setResultOpen(true);
    router.refresh();
  };

  const handleCancel = (reservationId: string) => {
    startTransition(async () => {
      const response = await cancelReservationAction(reservationId);
      handleResult(response, "Reserva cancelada");
    });
  };

  return (
    <>
      <div className="space-y-3 text-sm">
        {reservations.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma reserva encontrada.</p>
        ) : (
          reservations.map((reservation) => {
            const guestName = `${reservation.guest.firstName} ${reservation.guest.lastName}`;
            const statusLabel = STATUS_LABELS[reservation.status] ?? reservation.status;
            const paymentLabel = PAYMENT_LABELS[reservation.paymentStatus] ?? reservation.paymentStatus;
            const sourceLabel = SOURCE_LABELS[reservation.source] ?? reservation.source;
            const isCanceled = reservation.status === "CANCELED";

            return (
              <div
                key={reservation.id}
                className="card-lite rounded-2xl border border-border bg-surface-strong px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-base text-foreground">{guestName}</p>
                    <p className="text-xs text-muted">
                      {reservation.room?.number
                        ? `Quarto ${reservation.room.number}`
                        : "Quarto a definir"}{" "}
                      {"- "}
                      {formatDate(reservation.checkIn)}
                      {" -> "}
                      {formatDate(reservation.checkOut)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={isCanceled ? "critical" : "neutral"}>{statusLabel}</Pill>
                    <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs text-secondary">
                      {paymentLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    {sourceLabel} - {formatCurrency(reservation.totalAmount)}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(reservation)}
                      className="btn btn-outline btn-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(reservation.id)}
                      className="btn btn-ghost btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending || isCanceled}
                    >
                      {isPending ? "Cancelando..." : "Cancelar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing ? (
        <ReservationEditModal
          reservation={editing}
          rooms={roomOptions}
          onClose={() => setEditing(null)}
          onResult={(state) => handleResult(state, "Reserva atualizada")}
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
    </>
  );
}

function ReservationEditModal({
  reservation,
  rooms,
  onClose,
  onResult,
}: {
  reservation: ReservationItem;
  rooms: { value: string; label: string; status: string; category: string }[];
  onClose: () => void;
  onResult: (state: ReservationActionState) => void;
}) {
  const [state, formAction] = useActionState(updateReservationAction, initialActionState);
  const [selectedRoomId, setSelectedRoomId] = useState(
    reservation.roomId ?? "none"
  );
  const [manualRoomCategory, setManualRoomCategory] = useState(
    reservation.roomCategory
  );

  const selectedRoomCategory = useMemo(() => {
    if (selectedRoomId === "none") return manualRoomCategory;
    const match = rooms.find((room) => room.value === selectedRoomId);
    return match?.category ?? manualRoomCategory;
  }, [manualRoomCategory, rooms, selectedRoomId]);

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "ok") {
      onClose();
    }
    onResult(state);
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
            <p className="font-display text-lg text-foreground">Editar reserva</p>
            <p className="text-xs text-muted">
              {reservation.guest.firstName} {reservation.guest.lastName}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-5 text-sm">
          <input type="hidden" name="reservationId" value={reservation.id} />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Check-in
              </span>
              <input
                type="date"
                name="checkIn"
                defaultValue={formatDateInput(reservation.checkIn)}
                className="input-field"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Check-out
              </span>
              <input
                type="date"
                name="checkOut"
                defaultValue={formatDateInput(reservation.checkOut)}
                className="input-field"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Adultos
              </span>
              <input
                type="number"
                name="adults"
                min={1}
                defaultValue={reservation.adults}
                className="input-field"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Criancas
              </span>
              <input
                type="number"
                name="children"
                min={0}
                defaultValue={reservation.children}
                className="input-field"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Quarto
              </span>
              <select
                name="roomId"
                className="input-field"
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
              >
                <option value="none">Quarto a definir</option>
                {rooms.map((room) => (
                  <option key={room.value} value={room.value}>
                    {room.label} ({room.status})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Status
              </span>
              <select name="status" className="input-field" defaultValue={reservation.status}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Pagamento
              </span>
              <select
                name="paymentStatus"
                className="input-field"
                defaultValue={reservation.paymentStatus}
              >
                {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Origem
              </span>
              <select name="source" className="input-field" defaultValue={reservation.source}>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
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
                name="roomCategory"
                className="input-field"
                value={selectedRoomCategory}
                onChange={(event) => setManualRoomCategory(event.target.value)}
                disabled={selectedRoomId !== "none"}
              >
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
                defaultValue={reservation.seasonType ?? ""}
              >
                <option value="">Automatica</option>
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
                defaultValue={reservation.packageType ?? ""}
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Total (R$)
              </span>
              <input
                type="number"
                name="totalAmount"
                step="0.01"
                min={0}
                defaultValue={reservation.totalAmount ?? ""}
                className="input-field"
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
              defaultValue={reservation.notes ?? ""}
            />
          </label>

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
