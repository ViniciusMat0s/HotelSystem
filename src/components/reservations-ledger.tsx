"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  updateReservationAction,
  type ReservationActionState,
} from "@/actions/reservation";
import { ActionModal } from "@/components/action-modal";
import { Pill } from "@/components/cards";

type RoomItem = {
  id: string;
  number: string;
  name: string | null;
  status: string;
  category: string;
};

type ReservationItem = {
  id: string;
  roomId: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  guestName: string;
};

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  id: string;
  roomId: string;
  mode: DragMode;
  baseStart: number;
  baseEnd: number;
  offset: number;
  previewStart: number;
  previewEnd: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Reservada",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  NO_SHOW: "No-show",
  CANCELED: "Cancelada",
};

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * MS_PER_DAY);

const parseInputDate = (value: string) => {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
};

const parseDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
};

const formatInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const formatDayLabel = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")} ${MONTH_LABELS[date.getMonth()]}`;

const diffDays = (from: Date, to: Date) =>
  Math.round((normalizeDate(from).getTime() - normalizeDate(to).getTime()) / MS_PER_DAY);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roomSort = (a: { number: string }, b: { number: string }) => {
  const aNum = Number.parseInt(a.number, 10);
  const bNum = Number.parseInt(b.number, 10);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }
  return a.number.localeCompare(b.number, "pt-BR");
};

const statusTone = (status: string) => {
  if (status === "CHECKED_IN") return "positive";
  if (status === "BOOKED") return "neutral";
  if (status === "NO_SHOW") return "critical";
  return "warning";
};

const initialActionState: ReservationActionState = { status: "idle" };

export function ReservationsLedger({
  rooms,
  reservations,
  start,
  end,
}: {
  rooms: RoomItem[];
  reservations: ReservationItem[];
  start: string;
  end: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ReservationActionState | null>(null);
  const [resultTitle, setResultTitle] = useState("Reserva atualizada");
  const [resultOpen, setResultOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const [actionState, formAction] = useActionState(
    updateReservationAction,
    initialActionState
  );

  const { startDate, endDate } = useMemo(() => {
    const parsedStart = parseInputDate(start) ?? normalizeDate(new Date());
    let parsedEnd = parseInputDate(end) ?? addDays(parsedStart, 13);
    if (parsedEnd < parsedStart) {
      parsedEnd = parsedStart;
    }
    return { startDate: parsedStart, endDate: parsedEnd };
  }, [start, end]);

  const dates = useMemo(() => {
    const list: Date[] = [];
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      list.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return list;
  }, [startDate, endDate]);

  const sortedRooms = useMemo(() => [...rooms].sort(roomSort), [rooms]);

  const reservationsByRoom = useMemo(() => {
    return reservations.reduce<Record<string, ReservationItem[]>>((acc, item) => {
      if (!item.roomId) return acc;
      if (!acc[item.roomId]) {
        acc[item.roomId] = [];
      }
      acc[item.roomId].push(item);
      return acc;
    }, {});
  }, [reservations]);

  const columns = "220px 1fr";
  const dayColumns = `repeat(${dates.length}, minmax(70px, 1fr))`;
  const minWidth = 220 + dates.length * 70;

  const setRowRef = (roomId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      rowRefs.current.set(roomId, node);
    } else {
      rowRefs.current.delete(roomId);
    }
  };

  const updateDragState = useCallback((next: DragState) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const clearDragState = useCallback(() => {
    dragStateRef.current = null;
    setDragState(null);
  }, []);

  const getPointerIndex = useCallback(
    (roomId: string, clientX: number) => {
      const row = rowRefs.current.get(roomId);
      if (!row) return null;
      const rect = row.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const x = clamp(clientX - rect.left, 0, rect.width - 1);
      const dayWidth = rect.width / dates.length;
      return clamp(Math.floor(x / dayWidth), 0, dates.length - 1);
    },
    [dates.length]
  );

  const submitUpdate = useCallback(
    (reservationId: string, checkIn: Date, checkOut: Date) => {
      const formData = new FormData();
      formData.set("reservationId", reservationId);
      formData.set("checkIn", formatInputDate(checkIn));
      formData.set("checkOut", formatInputDate(checkOut));
      setSavingId(reservationId);
      formAction(formData);
    },
    [formAction]
  );

  const startDrag = useCallback(
    (
      event: React.PointerEvent,
      reservation: ReservationItem,
      mode: DragMode,
      baseStart: number,
      baseEnd: number
    ) => {
      if (savingId) return;
      if (event.button !== 0) return;
      if (!reservation.roomId) return;
      const pointerIndex = getPointerIndex(reservation.roomId, event.clientX);
      if (pointerIndex === null) return;
      const offset = mode === "move" ? pointerIndex - baseStart : 0;
      updateDragState({
        id: reservation.id,
        roomId: reservation.roomId,
        mode,
        baseStart,
        baseEnd,
        offset,
        previewStart: baseStart,
        previewEnd: baseEnd,
      });
      event.preventDefault();
    },
    [getPointerIndex, savingId, updateDragState]
  );

  useEffect(() => {
    if (actionState.status === "idle") return;
    setResult(actionState);
    setResultTitle(
      actionState.status === "ok" ? "Reserva atualizada" : "Falha ao atualizar"
    );
    setResultOpen(true);
    setSavingId(null);
    if (actionState.status === "ok") {
      router.refresh();
    }
  }, [actionState, router]);

  useEffect(() => {
    if (!dragState) return;
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousSelect;
    };
  }, [dragState]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;
      const pointerIndex = getPointerIndex(current.roomId, event.clientX);
      if (pointerIndex === null) return;
      const length = current.baseEnd - current.baseStart;
      let nextStart = current.previewStart;
      let nextEnd = current.previewEnd;
      if (current.mode === "move") {
        nextStart = clamp(pointerIndex - current.offset, 0, dates.length - length);
        nextEnd = nextStart + length;
      } else if (current.mode === "resize-start") {
        nextStart = clamp(pointerIndex, 0, current.baseEnd - 1);
        nextEnd = current.baseEnd;
      } else {
        nextStart = current.baseStart;
        nextEnd = clamp(pointerIndex + 1, current.baseStart + 1, dates.length);
      }
      if (nextStart === current.previewStart && nextEnd === current.previewEnd) {
        return;
      }
      updateDragState({ ...current, previewStart: nextStart, previewEnd: nextEnd });
    };

    const handleUp = () => {
      const current = dragStateRef.current;
      if (!current) return;
      clearDragState();
      if (
        current.previewStart === current.baseStart &&
        current.previewEnd === current.baseEnd
      ) {
        return;
      }
      const nextCheckIn = addDays(startDate, current.previewStart);
      const nextCheckOut = addDays(startDate, current.previewEnd);
      submitUpdate(current.id, nextCheckIn, nextCheckOut);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [clearDragState, dates.length, getPointerIndex, startDate, submitUpdate, updateDragState]);

  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <div className="space-y-2" style={{ minWidth }}>
          <div
            className="grid items-center gap-0 text-xs uppercase tracking-[0.2em] text-muted"
            style={{ gridTemplateColumns: columns }}
          >
            <div className="px-3">Quarto</div>
            <div className="grid gap-0" style={{ gridTemplateColumns: dayColumns }}>
              {dates.map((date) => (
                <div key={date.toISOString()} className="px-2 py-2 text-center">
                  {formatDayLabel(date)}
                </div>
              ))}
            </div>
          </div>

          {sortedRooms.length === 0 ? (
            <p className="text-sm text-muted">Nenhum quarto cadastrado.</p>
          ) : (
            sortedRooms.map((room) => {
              const roomReservations = reservationsByRoom[room.id] ?? [];
              return (
                <div
                  key={room.id}
                  className="grid items-stretch rounded-2xl border border-border/70 bg-surface/60"
                  style={{ gridTemplateColumns: columns }}
                >
                  <div className="flex flex-col justify-center gap-1 px-3 py-3">
                    <p className="font-display text-base text-foreground">
                      Quarto {room.number}
                    </p>
                    <p className="text-xs text-muted">{room.name ?? "Sem nome"}</p>
                  </div>
                  <div
                    className="relative min-h-[56px]"
                    ref={setRowRef(room.id)}
                  >
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: dayColumns }}
                    >
                      {dates.map((date, index) => (
                        <div
                          key={`${room.id}-${date.toISOString()}`}
                          className={`border-l border-border/40 ${
                            index === 0 ? "border-l-0" : ""
                          }`}
                        />
                      ))}
                    </div>
                    <div
                      className="absolute inset-0 grid items-center"
                      style={{ gridTemplateColumns: dayColumns }}
                    >
                      {roomReservations.map((reservation) => {
                        const checkIn = parseDateTime(reservation.checkIn);
                        const checkOut = parseDateTime(reservation.checkOut);
                        if (!checkIn || !checkOut) return null;
                        const baseStartIndex = Math.max(
                          0,
                          diffDays(checkIn, startDate)
                        );
                        const baseEndIndex = Math.min(
                          dates.length,
                          Math.max(baseStartIndex + 1, diffDays(checkOut, startDate))
                        );
                        if (baseEndIndex <= 0 || baseStartIndex >= dates.length) {
                          return null;
                        }
                        const isEditable =
                          checkIn >= startDate &&
                          checkOut <= addDays(endDate, 1) &&
                          !savingId;
                        const isDragging = dragState?.id === reservation.id;
                        const previewStart = isDragging
                          ? dragState.previewStart
                          : baseStartIndex;
                        const previewEnd = isDragging
                          ? dragState.previewEnd
                          : baseEndIndex;
                        const label =
                          STATUS_LABELS[reservation.status] ??
                          reservation.status.replace("_", " ");
                        return (
                          <div
                            key={reservation.id}
                            role="button"
                            onPointerDown={(event) =>
                              isEditable
                                ? startDrag(
                                    event,
                                    reservation,
                                    "move",
                                    baseStartIndex,
                                    baseEndIndex
                                  )
                                : undefined
                            }
                            className={`group relative mx-1 flex h-10 items-center rounded-2xl border border-border/60 bg-surface-strong/70 px-3 text-xs text-foreground shadow-tight transition-transform duration-200 ease-out ${
                              isEditable
                                ? isDragging
                                  ? "cursor-grabbing"
                                  : "cursor-grab hover:-translate-y-[1px]"
                                : "cursor-not-allowed opacity-60"
                            } ${isDragging ? "ring-1 ring-primary/40" : ""}`}
                            style={{
                              gridColumn: `${previewStart + 1} / ${previewEnd + 1}`,
                            }}
                            title={
                              isEditable
                                ? `${reservation.guestName} - ${label}`
                                : "Ajuste o periodo para editar esta reserva."
                            }
                          >
                            <span className="truncate pr-3">
                              {reservation.guestName}
                            </span>
                            <span className="ml-auto">
                              <Pill tone={statusTone(reservation.status)}>
                                {label}
                              </Pill>
                            </span>
                            {isEditable ? (
                              <>
                                <span
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    startDrag(
                                      event,
                                      reservation,
                                      "resize-start",
                                      baseStartIndex,
                                      baseEndIndex
                                    );
                                  }}
                                  className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 cursor-ew-resize rounded-full bg-foreground/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                                />
                                <span
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    startDrag(
                                      event,
                                      reservation,
                                      "resize-end",
                                      baseStartIndex,
                                      baseEndIndex
                                    );
                                  }}
                                  className="absolute right-1 top-1/2 h-5 w-1 -translate-y-1/2 cursor-ew-resize rounded-full bg-foreground/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                                />
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
