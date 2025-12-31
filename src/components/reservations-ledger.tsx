"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  createReservationAction,
  swapReservationAction,
  updateReservationAction,
  type ReservationActionState,
  type ReservationCreateState,
} from "@/actions/reservation";
import { ActionModal } from "@/components/action-modal";

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
  room: {
    number: string;
    name: string | null;
    category: string;
  } | null;
  roomCategory: string;
  checkIn: string;
  checkOut: string;
  status: string;
  paymentStatus: string;
  source: string;
  adults: number;
  children: number;
  totalAmount: string | null;
  packageType: string | null;
  seasonType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    documentId: string | null;
    nationality: string | null;
  };
  guestName: string;
  noShowStatus?: string | null;
};

type DragMode = "move" | "resize-start" | "resize-end";

type SelectionState = {
  roomId: string;
  startIndex: number;
  endIndex: number;
};

type QuickDraft = {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
};

type DragState = {
  id: string;
  baseRoomId: string;
  previewRoomId: string;
  mode: DragMode;
  baseStart: number;
  baseEnd: number;
  offset: number;
  previewStart: number;
  previewEnd: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AUTO_SCROLL_EDGE = 80;
const AUTO_SCROLL_SPEED = 18;
const AUTO_SCROLL_VERTICAL_SPEED = 14;
const AUTO_SCROLL_SMOOTHING = 0.25;

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

const NO_SHOW_LABELS: Record<string, string> = {
  PENDING: "Sem resposta",
  RESPONDED: "Respondido",
  ESCALATED: "Atraso",
  CLOSED: "Encerrado",
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

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
};

const formatDateTimeLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR");
};

const formatCurrencyValue = (value: string | null) => {
  if (!value) return "--";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const diffDays = (from: Date, to: Date) =>
  Math.round((normalizeDate(from).getTime() - normalizeDate(to).getTime()) / MS_PER_DAY);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const roomSort = (a: { number: string }, b: { number: string }) => {
  const aNum = Number.parseInt(a.number, 10);
  const bNum = Number.parseInt(b.number, 10);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }
  return a.number.localeCompare(b.number, "pt-BR");
};

const badgeVariant = (status: string, noShowStatus?: string | null) => {
  if (noShowStatus === "ESCALATED") return "late";
  if (noShowStatus === "PENDING") return "pending";
  if (status === "NO_SHOW") return "late";
  if (status === "CHECKED_IN" || status === "BOOKED") return "confirmed";
  return "neutral";
};

const initialActionState: ReservationActionState = { status: "idle" };
const initialCreateState: ReservationCreateState = { status: "idle" };

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
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [quickDraft, setQuickDraft] = useState<QuickDraft | null>(null);
  const [detailsReservation, setDetailsReservation] =
    useState<ReservationItem | null>(null);
  const [, startTransition] = useTransition();
  const closeQuickDraft = useCallback(() => {
    setQuickDraft(null);
  }, [setQuickDraft]);
  const closeDetails = useCallback(() => {
    setDetailsReservation(null);
  }, [setDetailsReservation]);
  const openDetails = useCallback(
    (reservation: ReservationItem) => {
      setDetailsReservation(reservation);
    },
    [setDetailsReservation]
  );
  const dragStateRef = useRef<DragState | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const scrollLoopRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollVelocityRef = useRef({ x: 0, y: 0 });
  const selectionRef = useRef<SelectionState | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const [updateState, updateFormAction] = useActionState(
    updateReservationAction,
    initialActionState
  );
  const [swapState, swapFormAction] = useActionState(
    swapReservationAction,
    initialActionState
  );

  const handleResult = useCallback(
    (state: { status: "idle" | "error" | "ok"; message?: string }, title: string) => {
      setResult(state);
      setResultTitle(title);
      setResultOpen(true);
      if (state.status === "ok") {
        router.refresh();
      }
    },
    [router]
  );

  const handleQuickResult = useCallback(
    (state: ReservationActionState) => {
      handleResult(
        state,
        state.status === "ok" ? "Reserva criada" : "Falha ao criar reserva"
      );
    },
    [handleResult]
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

  const reservationById = useMemo(() => {
    const map = new Map<string, ReservationItem>();
    reservations.forEach((reservation) => {
      map.set(reservation.id, reservation);
    });
    return map;
  }, [reservations]);

  const getConflicts = useCallback(
    (
      targetRoomId: string,
      startIndex: number,
      endIndex: number,
      reservationId: string
    ) => {
      const roomReservations = reservationsByRoom[targetRoomId] ?? [];
      if (roomReservations.length === 0) return [];
      return roomReservations.filter((reservation) => {
        if (reservation.id === reservationId) return false;
        const checkIn = parseDateTime(reservation.checkIn);
        const checkOut = parseDateTime(reservation.checkOut);
        if (!checkIn || !checkOut) return false;
        const otherStart = diffDays(checkIn, startDate);
        const otherEnd = diffDays(checkOut, startDate);
        return startIndex < otherEnd && endIndex > otherStart;
      });
    },
    [reservationsByRoom, startDate]
  );

  const dragConflicts = useMemo(() => {
    if (!dragState) return [];
    return getConflicts(
      dragState.previewRoomId,
      dragState.previewStart,
      dragState.previewEnd,
      dragState.id
    );
  }, [dragState, getConflicts]);

  const dragSwapCandidate = useMemo(() => {
    if (!dragState) return false;
    return (
      dragState.mode === "move" &&
      dragConflicts.length === 1
    );
  }, [dragConflicts.length, dragState]);

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
    dragPointerRef.current = null;
    setDragState(null);
  }, []);

  const updateSelection = useCallback((next: SelectionState | null) => {
    selectionRef.current = next;
    setSelection(next);
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

  const getRoomIdFromY = useCallback(
    (clientY: number) => {
      let nearestRoomId: string | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const room of sortedRooms) {
        const row = rowRefs.current.get(room.id);
        if (!row) continue;
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return room.id;
        }
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(clientY - center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestRoomId = room.id;
        }
      }
      return nearestRoomId;
    },
    [sortedRooms]
  );

  const submitUpdate = useCallback(
    (reservationId: string, checkIn: Date, checkOut: Date, roomId?: string) => {
      const formData = new FormData();
      formData.set("reservationId", reservationId);
      formData.set("checkIn", formatInputDate(checkIn));
      formData.set("checkOut", formatInputDate(checkOut));
      if (roomId) {
        formData.set("roomId", roomId);
      }
      setSavingId(reservationId);
      startTransition(() => {
        updateFormAction(formData);
      });
    },
    [startTransition, updateFormAction]
  );

  const submitSwap = useCallback(
    (
      reservationId: string,
      targetReservationId: string,
      checkIn: Date,
      checkOut: Date
    ) => {
      const formData = new FormData();
      formData.set("reservationId", reservationId);
      formData.set("targetReservationId", targetReservationId);
      formData.set("checkIn", formatInputDate(checkIn));
      formData.set("checkOut", formatInputDate(checkOut));
      setSavingId(reservationId);
      startTransition(() => {
        swapFormAction(formData);
      });
    },
    [startTransition, swapFormAction]
  );

  const updatePreviewFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragStateRef.current;
      if (!current) return;
      const targetRoomId =
        current.mode === "move"
          ? getRoomIdFromY(clientY) ?? current.previewRoomId
          : current.baseRoomId;
      if (!targetRoomId) return;
      const pointerIndex = getPointerIndex(targetRoomId, clientX);
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
      if (
        nextStart === current.previewStart &&
        nextEnd === current.previewEnd &&
        targetRoomId === current.previewRoomId
      ) {
        return;
      }
      updateDragState({
        ...current,
        previewRoomId: targetRoomId,
        previewStart: nextStart,
        previewEnd: nextEnd,
      });
    },
    [dates.length, getPointerIndex, getRoomIdFromY, updateDragState]
  );

  const computeAutoScroll = useCallback((clientX: number, clientY: number) => {
    let dx = 0;
    let dy = 0;
    const container = scrollContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const overflowX = container.scrollWidth > container.clientWidth + 2;
      if (overflowX) {
        const leftDistance = clientX - rect.left;
        const rightDistance = rect.right - clientX;
        if (leftDistance < AUTO_SCROLL_EDGE) {
          const strength = clamp(
            (AUTO_SCROLL_EDGE - leftDistance) / AUTO_SCROLL_EDGE,
            0,
            1
          );
          dx = -AUTO_SCROLL_SPEED * easeOutCubic(strength);
        } else if (rightDistance < AUTO_SCROLL_EDGE) {
          const strength = clamp(
            (AUTO_SCROLL_EDGE - rightDistance) / AUTO_SCROLL_EDGE,
            0,
            1
          );
          dx = AUTO_SCROLL_SPEED * easeOutCubic(strength);
        }
      }
    }
    const viewportHeight = window.innerHeight;
    if (viewportHeight > 0) {
      if (clientY < AUTO_SCROLL_EDGE) {
        const strength = clamp(
          (AUTO_SCROLL_EDGE - clientY) / AUTO_SCROLL_EDGE,
          0,
          1
        );
        dy = -AUTO_SCROLL_VERTICAL_SPEED * easeOutCubic(strength);
      } else if (viewportHeight - clientY < AUTO_SCROLL_EDGE) {
        const strength = clamp(
          (AUTO_SCROLL_EDGE - (viewportHeight - clientY)) / AUTO_SCROLL_EDGE,
          0,
          1
        );
        dy = AUTO_SCROLL_VERTICAL_SPEED * easeOutCubic(strength);
      }
    }
    return { dx, dy };
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (scrollLoopRef.current) {
      window.cancelAnimationFrame(scrollLoopRef.current);
      scrollLoopRef.current = null;
    }
    scrollVelocityRef.current = { x: 0, y: 0 };
  }, []);

  const runAutoScroll = useCallback(function runAutoScrollLoop() {
    if (!dragStateRef.current) {
      stopAutoScroll();
      return;
    }
    const pointer = dragPointerRef.current;
    if (!pointer) {
      scrollLoopRef.current = window.requestAnimationFrame(runAutoScrollLoop);
      return;
    }
    const target = computeAutoScroll(pointer.x, pointer.y);
    const velocity = scrollVelocityRef.current;
    velocity.x += (target.dx - velocity.x) * AUTO_SCROLL_SMOOTHING;
    velocity.y += (target.dy - velocity.y) * AUTO_SCROLL_SMOOTHING;
    if (Math.abs(velocity.x) < 0.05) velocity.x = 0;
    if (Math.abs(velocity.y) < 0.05) velocity.y = 0;
    if (velocity.x !== 0 || velocity.y !== 0) {
      const container = scrollContainerRef.current;
      if (container && velocity.x !== 0) {
        container.scrollLeft += velocity.x;
      }
      if (velocity.y !== 0) {
        window.scrollBy({ top: velocity.y, left: 0 });
      }
      updatePreviewFromPointer(pointer.x, pointer.y);
    }
    scrollLoopRef.current = window.requestAnimationFrame(runAutoScrollLoop);
  }, [computeAutoScroll, stopAutoScroll, updatePreviewFromPointer]);

  const startAutoScroll = useCallback(() => {
    if (scrollLoopRef.current) return;
    scrollLoopRef.current = window.requestAnimationFrame(runAutoScroll);
  }, [runAutoScroll]);

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
        baseRoomId: reservation.roomId,
        previewRoomId: reservation.roomId,
        mode,
        baseStart,
        baseEnd,
        offset,
        previewStart: baseStart,
        previewEnd: baseEnd,
      });
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      dragOriginRef.current = { x: event.clientX, y: event.clientY };
      suppressClickRef.current = false;
      startAutoScroll();
      event.preventDefault();
    },
    [getPointerIndex, savingId, startAutoScroll, updateDragState]
  );

  const startSelection = useCallback(
    (event: React.PointerEvent, roomId: string) => {
      if (savingId || dragStateRef.current || quickDraft) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-reservation]")) return;
      const pointerIndex = getPointerIndex(roomId, event.clientX);
      if (pointerIndex === null) return;
      updateSelection({ roomId, startIndex: pointerIndex, endIndex: pointerIndex });
      event.preventDefault();
    },
    [getPointerIndex, quickDraft, savingId, updateSelection]
  );

  useEffect(() => {
    if (updateState.status === "idle") return;
    handleResult(
      updateState,
      updateState.status === "ok" ? "Reserva atualizada" : "Falha ao atualizar"
    );
    setSavingId(null);
  }, [handleResult, updateState]);

  useEffect(() => {
    if (swapState.status === "idle") return;
    handleResult(
      swapState,
      swapState.status === "ok" ? "Reservas trocadas" : "Falha ao trocar reservas"
    );
    setSavingId(null);
  }, [handleResult, swapState]);

  useEffect(() => {
    if (!dragState) return;
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousSelect;
    };
  }, [dragState]);

  useEffect(() => {
    const handleSelectionMove = (event: PointerEvent) => {
      const current = selectionRef.current;
      if (!current) return;
      const pointerIndex = getPointerIndex(current.roomId, event.clientX);
      if (pointerIndex === null || pointerIndex === current.endIndex) return;
      updateSelection({ ...current, endIndex: pointerIndex });
    };

    const handleSelectionEnd = () => {
      const current = selectionRef.current;
      if (!current) return;
      updateSelection(null);
      const startIndex = Math.min(current.startIndex, current.endIndex);
      const endIndex = Math.max(current.startIndex, current.endIndex);
      const checkIn = addDays(startDate, startIndex);
      const checkOut = addDays(startDate, endIndex + 1);
      setQuickDraft({ roomId: current.roomId, checkIn, checkOut });
    };

    window.addEventListener("pointermove", handleSelectionMove);
    window.addEventListener("pointerup", handleSelectionEnd);
    window.addEventListener("pointercancel", handleSelectionEnd);
    return () => {
      window.removeEventListener("pointermove", handleSelectionMove);
      window.removeEventListener("pointerup", handleSelectionEnd);
      window.removeEventListener("pointercancel", handleSelectionEnd);
    };
  }, [getPointerIndex, startDate, updateSelection]);

  useEffect(() => {
    if (dragState) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }, [dragState, startAutoScroll, stopAutoScroll]);

  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return;
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      const origin = dragOriginRef.current;
      if (origin && !suppressClickRef.current) {
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (Math.hypot(dx, dy) > 4) {
          suppressClickRef.current = true;
        }
      }
      updatePreviewFromPointer(event.clientX, event.clientY);
    };

    const handleUp = () => {
      const current = dragStateRef.current;
      if (!current) return;
      const conflicts = getConflicts(
        current.previewRoomId,
        current.previewStart,
        current.previewEnd,
        current.id
      );
      clearDragState();
      dragOriginRef.current = null;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      if (conflicts.length > 0) {
        if (current.mode === "move" && conflicts.length === 1) {
          const nextCheckIn = addDays(startDate, current.previewStart);
          const nextCheckOut = addDays(startDate, current.previewEnd);
          submitSwap(current.id, conflicts[0].id, nextCheckIn, nextCheckOut);
          return;
        }
        handleResult(
          {
            status: "error",
            message:
              "Conflito detectado: ja existe uma reserva nesse periodo para este quarto.",
          },
          "Conflito ao mover"
        );
        return;
      }
      const roomChanged = current.previewRoomId !== current.baseRoomId;
      if (
        current.previewStart === current.baseStart &&
        current.previewEnd === current.baseEnd &&
        !roomChanged
      ) {
        return;
      }
      const nextCheckIn = addDays(startDate, current.previewStart);
      const nextCheckOut = addDays(startDate, current.previewEnd);
      submitUpdate(
        current.id,
        nextCheckIn,
        nextCheckOut,
        roomChanged ? current.previewRoomId : undefined
      );
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [
    clearDragState,
    handleResult,
    getConflicts,
    startDate,
    submitSwap,
    submitUpdate,
    updatePreviewFromPointer,
  ]);

  return (
    <>
      <div className="mt-6 overflow-x-auto" ref={scrollContainerRef}>
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
              const isUnavailable =
                room.status === "MAINTENANCE" || room.status === "OUT_OF_SERVICE";
              const roomReservations = reservationsByRoom[room.id] ?? [];
              const draggingReservation = dragState
                ? reservationById.get(dragState.id) ?? null
                : null;
              const showDragPreview =
                dragState &&
                draggingReservation &&
                dragState.previewRoomId === room.id &&
                !roomReservations.some((item) => item.id === dragState.id);
              const visibleReservations = showDragPreview
                ? [...roomReservations, draggingReservation]
                : roomReservations;
              const isTargetRow = dragState?.previewRoomId === room.id;
              const isSwapRow = Boolean(isTargetRow && dragSwapCandidate);
              const isConflictRow = Boolean(
                isTargetRow && dragConflicts.length > 0 && !isSwapRow
              );
              const selectionRange =
                selection && selection.roomId === room.id
                  ? {
                      start: Math.min(selection.startIndex, selection.endIndex),
                      end: Math.max(selection.startIndex, selection.endIndex),
                    }
                  : null;
              return (
                <div
                  key={room.id}
                  className={`relative grid items-stretch rounded-2xl border border-border/70 bg-surface/60 ${
                    isTargetRow
                      ? isSwapRow
                        ? "border-accent/60 ring-1 ring-accent/50"
                        : isConflictRow
                        ? "border-primary/60 ring-1 ring-primary/50"
                        : "border-secondary/60 ring-1 ring-secondary/50"
                      : ""
                  }`}
                  style={{ gridTemplateColumns: columns }}
                >
                  {isUnavailable ? (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-rose-500/10 backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(244,63,94,0.18)]" />
                  ) : null}
                  {isTargetRow ? (
                    <span
                      className={`pointer-events-none absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                        isSwapRow
                          ? "bg-accent/20 text-accent"
                          : isConflictRow
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary/20 text-secondary"
                      }`}
                    >
                      {isSwapRow ? "Troca" : isConflictRow ? "Conflito" : "Destino"}
                    </span>
                  ) : null}
                  <div className="relative z-10 flex flex-col justify-center gap-1 px-3 py-3">
                    <p
                      className={`font-display text-base ${
                        isUnavailable ? "text-rose-400" : "text-foreground"
                      }`}
                    >
                      Quarto {room.number}
                    </p>
                    <p
                      className={`text-xs ${
                        isUnavailable ? "text-rose-300/80" : "text-muted"
                      }`}
                    >
                      {room.name ?? "Sem nome"}
                    </p>
                  </div>
                  <div
                    className="relative z-10 min-h-[56px]"
                    ref={setRowRef(room.id)}
                    onPointerDown={(event) => startSelection(event, room.id)}
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
                    {selectionRange ? (
                      <div
                        className="pointer-events-none absolute inset-0 grid items-center"
                        style={{ gridTemplateColumns: dayColumns }}
                      >
                        <div
                          className="mx-1 flex h-10 items-center rounded-2xl border border-secondary/50 bg-secondary/15 px-3 text-xs text-secondary shadow-tight"
                          style={{
                            gridColumn: `${selectionRange.start + 1} / ${
                              selectionRange.end + 2
                            }`,
                          }}
                        >
                          Nova reserva
                        </div>
                      </div>
                    ) : null}
                    <div
                      className="absolute inset-0 grid items-center"
                      style={{ gridTemplateColumns: dayColumns }}
                    >
                      {visibleReservations.map((reservation) => {
                        if (
                          dragState &&
                          reservation.id === dragState.id &&
                          dragState.previewRoomId !== room.id
                        ) {
                          return null;
                        }
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
                            data-reservation
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
                            onPointerUp={(event) => {
                              if (suppressClickRef.current) return;
                              const target = event.target as HTMLElement;
                              if (target.closest("[data-resize-handle]")) return;
                              openDetails(reservation);
                            }}
                            className={`group relative mx-1 flex h-10 items-center rounded-2xl border border-border/60 bg-surface-strong/70 px-3 text-xs text-foreground shadow-tight transition-transform duration-200 ease-out ${
                              isEditable
                                ? isDragging
                                  ? "cursor-grabbing"
                                  : "cursor-grab hover:-translate-y-[1px]"
                                : "cursor-not-allowed opacity-60"
                            } ${
                              isDragging
                                ? isSwapRow
                                  ? "ring-1 ring-accent/60"
                                  : isConflictRow
                                  ? "ring-1 ring-primary/60"
                                  : "ring-1 ring-secondary/40"
                                : ""
                            }`}
                            style={{
                              gridColumn: `${previewStart + 1} / ${previewEnd + 1}`,
                            }}
                            title={
                              isEditable
                                ? isDragging && isSwapRow
                                  ? "Solte para trocar com a reserva deste quarto."
                                  : isDragging && isConflictRow
                                  ? "Conflito com outra reserva neste quarto."
                                  : `${reservation.guestName} - ${label}`
                                : "Ajuste o periodo para editar esta reserva."
                            }
                          >
                            <span className="min-w-0 flex-1 truncate pr-2">
                              {reservation.guestName}
                            </span>
                            <span className="ml-auto">
                              <StatusBadge
                                status={reservation.status}
                                label={label}
                                noShowStatus={reservation.noShowStatus}
                              />
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
                                  data-resize-handle
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
                                  data-resize-handle
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

        {quickDraft ? (
          <QuickReservationModal
            draft={quickDraft}
            room={rooms.find((room) => room.id === quickDraft.roomId) ?? null}
            onClose={closeQuickDraft}
            onResult={handleQuickResult}
          />
        ) : null}

        {detailsReservation ? (
          <ReservationDetailsModal
            reservation={detailsReservation}
            onClose={closeDetails}
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

function StatusBadge({
  status,
  label,
  noShowStatus,
}: {
  status: string;
  label: string;
  noShowStatus?: string | null;
}) {
  const variant = badgeVariant(status, noShowStatus);
  const displayLabel =
    variant === "confirmed"
      ? "Confirmada"
      : variant === "pending"
      ? "Sem resposta"
      : variant === "late"
      ? "Atraso"
      : label;
  const toneClass =
    variant === "confirmed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
      : variant === "pending"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
      : variant === "late"
      ? "bg-rose-500/15 text-rose-400 border-rose-500/40"
      : "bg-surface-strong text-muted border-white/10";

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${toneClass}`}
      title={displayLabel}
      aria-label={displayLabel}
    >
      <StatusIcon variant={variant} status={status} />
    </span>
  );
}

function StatusIcon({
  variant,
  status,
}: {
  variant: "confirmed" | "pending" | "late" | "neutral";
  status: string;
}) {
  const className = "h-3.5 w-3.5";
  if (variant === "confirmed") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (variant === "pending") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    );
  }
  if (variant === "late") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.2L3.6 17.5c-.7 1.3.2 2.5 1.7 2.5h13.4c1.5 0 2.4-1.2 1.7-2.5L13.7 4.2c-.7-1.4-2.7-1.4-3.4 0z" />
      </svg>
    );
  }
  if (status === "CHECKED_OUT") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h10" />
        <path d="M12 8l4 4-4 4" />
      </svg>
    );
  }
  if (status === "NO_SHOW") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 7v6" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (status === "CANCELED") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 7l10 10" />
        <path d="M17 7l-10 10" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 3v6" />
      <path d="M16 3v6" />
      <path d="M4 10h16" />
    </svg>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function ReservationDetailsModal({
  reservation,
  onClose,
}: {
  reservation: ReservationItem;
  onClose: () => void;
}) {
  const statusLabel = STATUS_LABELS[reservation.status] ?? reservation.status;
  const paymentLabel =
    PAYMENT_LABELS[reservation.paymentStatus] ?? reservation.paymentStatus;
  const sourceLabel = SOURCE_LABELS[reservation.source] ?? reservation.source;
  const roomCategoryLabel =
    ROOM_CATEGORY_LABELS[reservation.roomCategory] ?? reservation.roomCategory;
  const seasonLabel = reservation.seasonType
    ? SEASON_LABELS[reservation.seasonType] ?? reservation.seasonType
    : "Automatica";
  const noShowLabel = reservation.noShowStatus
    ? NO_SHOW_LABELS[reservation.noShowStatus] ?? reservation.noShowStatus
    : null;
  const guestName = `${reservation.guest.firstName} ${reservation.guest.lastName}`;
  const roomLabel = reservation.room?.number
    ? `Quarto ${reservation.room.number}`
    : "Quarto a definir";
  const guestsLabel = `${reservation.adults} adultos • ${reservation.children} criancas`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="panel-strong w-full max-w-4xl rounded-3xl border border-border bg-surface-strong p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg text-foreground">{guestName}</p>
            <p className="text-xs text-muted">
              {roomLabel} • {formatDateLabel(reservation.checkIn)} ate{" "}
              {formatDateLabel(reservation.checkOut)}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Reserva</p>
            <div className="mt-3 space-y-2">
              <DetailRow
                label="Status"
                value={
                  <span className="inline-flex items-center gap-2">
                    <StatusBadge
                      status={reservation.status}
                      label={statusLabel}
                      noShowStatus={reservation.noShowStatus}
                    />
                    {statusLabel}
                  </span>
                }
              />
              {noShowLabel ? (
                <DetailRow label="No-show" value={noShowLabel} />
              ) : null}
              <DetailRow
                label="Check-in"
                value={formatDateLabel(reservation.checkIn)}
              />
              <DetailRow
                label="Check-out"
                value={formatDateLabel(reservation.checkOut)}
              />
              <DetailRow label="Hospedes" value={guestsLabel} />
              <DetailRow label="Quarto" value={roomLabel} />
              <DetailRow
                label="Nome do quarto"
                value={reservation.room?.name ?? "--"}
              />
              <DetailRow label="Categoria" value={roomCategoryLabel} />
              <DetailRow label="Temporada" value={seasonLabel} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Cliente</p>
            <div className="mt-3 space-y-2">
              <DetailRow label="Nome" value={guestName} />
              <DetailRow label="Email" value={reservation.guest.email ?? "--"} />
              <DetailRow
                label="Telefone"
                value={reservation.guest.phone ?? "--"}
              />
              <DetailRow
                label="Documento"
                value={reservation.guest.documentId ?? "--"}
              />
              <DetailRow
                label="Nacionalidade"
                value={reservation.guest.nationality ?? "--"}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Financeiro
            </p>
            <div className="mt-3 space-y-2">
              <DetailRow label="Pagamento" value={paymentLabel} />
              <DetailRow
                label="Total"
                value={formatCurrencyValue(reservation.totalAmount)}
              />
              <DetailRow label="Fonte" value={sourceLabel} />
              <DetailRow
                label="Pacote"
                value={reservation.packageType ?? "--"}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Observacoes
            </p>
            <p className="mt-3 text-sm text-muted">
              {reservation.notes?.trim() ? reservation.notes : "Sem observacoes."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Registro</p>
            <div className="mt-3 space-y-2">
              <DetailRow
                label="Criada em"
                value={formatDateTimeLabel(reservation.createdAt)}
              />
              <DetailRow
                label="Atualizada em"
                value={formatDateTimeLabel(reservation.updatedAt)}
              />
              <DetailRow label="ID" value={reservation.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickReservationModal({
  draft,
  room,
  onClose,
  onResult,
}: {
  draft: QuickDraft;
  room: RoomItem | null;
  onClose: () => void;
  onResult: (state: ReservationActionState) => void;
}) {
  const [state, formAction] = useActionState(
    createReservationAction,
    initialCreateState
  );

  useEffect(() => {
    if (state.status === "idle") return;
    onResult({ status: state.status, message: state.message });
    if (state.status === "ok") {
      onClose();
    }
  }, [onClose, onResult, state.message, state.status]);

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
            <p className="font-display text-lg text-foreground">Nova reserva</p>
            <p className="text-xs text-muted">
              {room ? `Quarto ${room.number}` : "Quarto selecionado"} -{" "}
              {formatInputDate(draft.checkIn)} ate {formatInputDate(draft.checkOut)}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-4 text-sm">
          <input type="hidden" name="guestMode" value="new" />
          <input type="hidden" name="roomId" value={draft.roomId} />
          <input type="hidden" name="checkIn" value={formatInputDate(draft.checkIn)} />
          <input type="hidden" name="checkOut" value={formatInputDate(draft.checkOut)} />
          <input type="hidden" name="status" value="BOOKED" />
          <input type="hidden" name="paymentStatus" value="PENDING" />
          <input type="hidden" name="source" value="DIRECT" />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="guestFirstName"
              placeholder="Nome"
              className="input-field"
              required
            />
            <input
              name="guestLastName"
              placeholder="Sobrenome"
              className="input-field"
              required
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
          </div>

          <textarea
            name="notes"
            placeholder="Observacoes internas"
            className="input-field min-h-[110px] resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">
              Reserva rapida: preencha o minimo para confirmar.
            </span>
            <div className="flex gap-3">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Criar reserva
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
