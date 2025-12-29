"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBrandingStore } from "@/stores/branding-store";

const NAV_ITEMS = [
  { href: "/", label: "Painel", detail: "Visao geral" },
  { href: "/rooms", label: "Quartos", detail: "Livro de reservas" },
  { href: "/finance", label: "Financeiro", detail: "Receita e lucro" },
  { href: "/maintenance", label: "Manutencao", detail: "Incidentes e recorrencia" },
  { href: "/pricing", label: "Precificacao", detail: "Mercado e clima" },
  { href: "/reservations", label: "Reservas", detail: "WhatsApp + Booking" },
  { href: "/crm", label: "CRM", detail: "Reciclagem e perfis" },
  { href: "/feedback", label: "Pos-venda", detail: "Feedback automatico" },
  { href: "/settings", label: "Perfil", detail: "White-label e tema" },
];

function BrandMark() {
  const brandName = useBrandingStore((state) => state.brandName);
  const logoUrl = useBrandingStore((state) => state.logoUrl);

  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-lg">V</span>
        )}
      </div>
      <div>
        <p className="font-display text-lg leading-tight text-foreground">{brandName}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          Hotel ops
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="panel-strong sticky top-0 hidden h-screen flex-col gap-10 p-6 lg:flex">
        <BrandMark />
        <nav className="flex flex-col gap-2 text-sm">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl border px-4 py-3 transition ${
                  isActive
                    ? "border-transparent bg-primary text-white shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
                    : "border-border bg-surface-strong text-foreground hover:-translate-y-[1px] hover:border-primary"
                }`}
              >
                <p className="font-display text-base">{item.label}</p>
                <p className={`text-xs ${isActive ? "text-white/80" : "text-muted"}`}>
                  {item.detail}
                </p>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 rounded-2xl border border-border bg-surface p-4 text-xs">
          <p className="uppercase tracking-[0.2em] text-muted">Status ao vivo</p>
          <div className="flex items-center justify-between text-foreground">
            <span>Booking.com</span>
            <span className="rounded-full bg-secondary/20 px-2 py-1 text-secondary">
              Sync 5m
            </span>
          </div>
          <div className="flex items-center justify-between text-foreground">
            <span>WhatsApp</span>
            <span className="rounded-full bg-accent/20 px-2 py-1 text-accent">
              Online
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Vennity OS
            </p>
            <h1 className="font-display text-2xl text-foreground">
              Operacao conectada, em tempo real
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <button className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition hover:border-primary">
              Sincronizar canais
            </button>
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-white shadow-[0_14px_28px_rgba(0,0,0,0.2)]">
              Nova reserva
            </button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-surface/70 px-6 py-3 text-xs lg:hidden">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full border px-3 py-1 ${
                  isActive
                    ? "border-transparent bg-primary text-white"
                    : "border-border bg-surface-strong text-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 px-6 pb-12 pt-8">{children}</main>
      </div>
    </div>
  );
}
