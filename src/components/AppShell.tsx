import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${WEEK[d.getDay()]} ${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

const tabs = [
  { to: "/", label: "今日" },
  { to: "/history", label: "歷史" },
  { to: "/settings", label: "設定" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      <div className="pointer-events-none absolute -left-16 -top-24 size-64 rounded-full bg-halo/30 blur-3xl animate-drift" />
      <div className="pointer-events-none absolute -right-20 top-64 size-72 rounded-full bg-halo2/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-40 size-60 rounded-full bg-halo3/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-28 pt-3.5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-ink font-disp text-sm font-black text-paper">
              燃
            </span>
            <span className="font-disp text-sm font-extrabold tracking-tight">燃數 BURNLOG</span>
          </div>
          <span className="font-mono text-[11px] tracking-tight text-muted">{today()}</span>
        </header>

        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[430px] gap-1.5 border-t border-white/60 bg-paper/85 px-5 pb-5 pt-3 backdrop-blur-2xl">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.to === "/" }}
            className="rounded-full bg-ink/5 px-3 py-1 text-xs text-muted transition"
            activeProps={{ className: "!bg-ink !text-paper font-medium" }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
