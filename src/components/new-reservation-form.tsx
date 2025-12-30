"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  createReservationAction,
  type ReservationCreateState,
} from "@/actions/reservation";
import { ActionModal } from "@/components/action-modal";

type RoomOption = {
  id: string;
  number: string;
  status: string;
  category: string;
};

type GuestOption = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

const initialState: ReservationCreateState = { status: "idle" };

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  BOOKED: "Reservada",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  CANCELED: "Cancelada",
  NO_SHOW: "No-show",
};

const RESERVATION_SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Direto",
  BOOKING: "Booking.com",
  WHATSAPP: "WhatsApp",
  WALK_IN: "Walk-in",
  OTA: "OTA",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  PARTIAL: "Parcial",
  REFUNDED: "Reembolsado",
  FAILED: "Falhou",
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

const reservationStatusOptions = Object.keys(RESERVATION_STATUS_LABELS);
const reservationSourceOptions = Object.keys(RESERVATION_SOURCE_LABELS);
const paymentStatusOptions = Object.keys(PAYMENT_STATUS_LABELS);
const roomCategoryOptions = Object.keys(ROOM_CATEGORY_LABELS);
const seasonOptions = Object.keys(SEASON_LABELS);

export function NewReservationForm({
  rooms,
  guests,
}: {
  rooms: RoomOption[];
  guests: GuestOption[];
}) {
  const [state, formAction] = useActionState(createReservationAction, initialState);
  const [guestMode, setGuestMode] = useState<"existing" | "new">(
    guests.length ? "existing" : "new"
  );
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [roomCategory, setRoomCategory] = useState("STANDARD");
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const guestOptions = useMemo(
    () =>
      guests.map((guest) => ({
        value: guest.id,
        label: `${guest.firstName} ${guest.lastName}`,
      })),
    [guests]
  );
  const selectedRoomCategory = useMemo(() => {
    if (!selectedRoomId) return roomCategory;
    const match = rooms.find((room) => room.id === selectedRoomId);
    return match?.category ?? roomCategory;
  }, [rooms, roomCategory, selectedRoomId]);

  const modalTitle =
    state.status === "error" ? "Reserva nao concluida" : "Reserva criada";
  const modalTone = state.status === "error" ? "error" : "success";
  const modalDetails =
    state.status === "ok" && state.reservationId
      ? `Codigo: ${state.reservationId}`
      : undefined;
  const modalKey =
    state.status === "idle"
      ? null
      : [state.status, state.message ?? "", state.reservationId ?? ""].join("|");
  const isModalOpen = modalKey !== null && modalKey !== dismissedKey;
  const handleModalClose = () => {
    if (modalKey) {
      setDismissedKey(modalKey);
    }
  };

  return (
    <>
      <form action={formAction} className="space-y-8 text-sm">
      <input type="hidden" name="guestMode" value={guestMode} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">Hospede</p>
            <p className="text-xs text-muted">
              Use um cadastro existente ou crie um novo.
            </p>
          </div>
          <div className="toggle-shell">
            <button
              type="button"
              onClick={() => setGuestMode("existing")}
              className={`toggle-pill ${
                guestMode === "existing" ? "toggle-pill-active" : ""
              }`}
            >
              Existente
            </button>
            <button
              type="button"
              onClick={() => setGuestMode("new")}
              className={`toggle-pill ${
                guestMode === "new" ? "toggle-pill-active" : ""
              }`}
            >
              Novo
            </button>
          </div>
        </div>

        {guestMode === "existing" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">
                Hospede
              </span>
              <select
                name="guestId"
                required
                className="input-field"
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione um hospede
                </option>
                {guestOptions.map((guest) => (
                  <option key={guest.value} value={guest.value}>
                    {guest.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-border bg-surface-strong p-4 text-xs text-muted">
              {guestOptions.length === 0
                ? "Sem hospedes cadastrados ainda."
                : "Use o cadastro para agilizar confirmacao e contato."}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="guestFirstName"
              placeholder="Nome"
              className="input-field"
              required={guestMode === "new"}
            />
            <input
              name="guestLastName"
              placeholder="Sobrenome"
              className="input-field"
              required={guestMode === "new"}
            />
            <input
              name="guestEmail"
              type="email"
              placeholder="Email (opcional)"
              className="input-field"
            />
            <input
              name="guestPhone"
              placeholder="Telefone/WhatsApp"
              className="input-field"
            />
            <input
              name="guestDocumentId"
              placeholder="Documento (opcional)"
              className="input-field"
            />
            <input
              name="guestNationality"
              placeholder="Nacionalidade (opcional)"
              className="input-field"
            />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-display text-lg text-foreground">Reserva</p>
          <p className="text-xs text-muted">
            Escolha datas, quarto e detalhes do pacote.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            type="date"
            name="checkIn"
            className="input-field"
            required
          />
          <input
            type="date"
            name="checkOut"
            className="input-field"
            required
          />
          <input
            type="number"
            name="adults"
            min={1}
            defaultValue={2}
            className="input-field"
            placeholder="Adultos"
          />
          <input
            type="number"
            name="children"
            min={0}
            defaultValue={0}
            className="input-field"
            placeholder="Criancas"
          />
          <select
            name="roomId"
            className="input-field"
            defaultValue=""
            onChange={(event) => setSelectedRoomId(event.target.value)}
          >
            <option value="">Quarto a definir</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number} - {ROOM_CATEGORY_LABELS[room.category] ?? room.category}{" "}
                ({room.status})
              </option>
            ))}
          </select>
          <select
            name="roomCategory"
            className="input-field"
            value={selectedRoomCategory}
            onChange={(event) => setRoomCategory(event.target.value)}
            disabled={Boolean(selectedRoomId)}
          >
            {roomCategoryOptions.map((value) => (
              <option key={value} value={value}>
                {ROOM_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
          {selectedRoomId ? (
            <p className="text-xs text-muted md:col-span-2 lg:col-span-3">
              Categoria definida automaticamente pelo quarto selecionado.
            </p>
          ) : null}
          <input
            name="packageType"
            placeholder="Pacote (opcional)"
            className="input-field"
          />
          <select name="seasonType" className="input-field" defaultValue="">
            <option value="">Temporada automatica</option>
            {seasonOptions.map((value) => (
              <option key={value} value={value}>
                {SEASON_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-display text-lg text-foreground">Pagamento</p>
          <p className="text-xs text-muted">
            Pagamentos aprovados disparam confirmacao e chave digital.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <select
            name="paymentStatus"
            className="input-field"
            defaultValue="PENDING"
          >
            {paymentStatusOptions.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="totalAmount"
            min={0}
            step="0.01"
            placeholder="Total (R$)"
            className="input-field"
          />
          <select
            name="status"
            className="input-field"
            defaultValue="BOOKED"
          >
            {reservationStatusOptions.map((value) => (
              <option key={value} value={value}>
                {RESERVATION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            name="source"
            className="input-field"
            defaultValue="DIRECT"
          >
            {reservationSourceOptions.map((value) => (
              <option key={value} value={value}>
                {RESERVATION_SOURCE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="notes"
          placeholder="Observacoes internas"
          className="input-field min-h-[120px] resize-none"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary">
          Criar reserva
        </button>
        <Link href="/reservations" className="btn btn-outline">
          Voltar para reservas
        </Link>
      </div>

      </form>
      <ActionModal
        open={isModalOpen}
        tone={modalTone}
        title={modalTitle}
        description={state.message}
        details={modalDetails}
        onClose={handleModalClose}
        actionLabel="Ok, entendi"
      />
    </>
  );
}
