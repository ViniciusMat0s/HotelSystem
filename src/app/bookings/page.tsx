import { Panel } from "@/components/cards";
import { ReservationsLedger } from "@/components/reservations-ledger";
import { getReservationLedger } from "@/lib/availability";
import { ensureDefaultHotel } from "@/lib/hotel";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * MS_PER_DAY);

const parseDate = (value?: string | string[]) => {
  if (!value || Array.isArray(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
};

const formatInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

type SearchParams = {
  start?: string;
  end?: string;
};

export default async function BookingLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const today = normalizeDate(new Date());
  const resolvedParams = await searchParams;
  const startDate = parseDate(resolvedParams?.start) ?? today;
  let endDate = parseDate(resolvedParams?.end) ?? addDays(startDate, 13);
  if (endDate < startDate) {
    endDate = startDate;
  }

  const hotel = await ensureDefaultHotel();
  const { rooms, reservations } = await getReservationLedger({
    hotelId: hotel.id,
    startDate,
    endDate,
  });

  const reservationItems = reservations.map((reservation) => ({
    id: reservation.id,
    roomId: reservation.roomId,
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    status: reservation.status,
    guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
  }));

  return (
    <div className="space-y-8">
      <Panel
        title="Livro de reservas"
        description="Calendario com todos os quartos e reservas confirmadas."
      >
        <form method="get" className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Inicio
            </span>
            <input
              type="date"
              name="start"
              defaultValue={formatInputDate(startDate)}
              className="input-field"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">
              Fim
            </span>
            <input
              type="date"
              name="end"
              defaultValue={formatInputDate(endDate)}
              className="input-field"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn btn-outline w-full">
              Atualizar
            </button>
          </div>
        </form>
        <ReservationsLedger
          rooms={rooms}
          reservations={reservationItems}
          start={formatInputDate(startDate)}
          end={formatInputDate(endDate)}
        />
      </Panel>
    </div>
  );
}
