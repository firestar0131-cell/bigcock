import type { ReactNode } from "react";
import { SiteGate } from "./SiteGate";

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${WEEK[d.getDay()]} ${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <SiteGate>
      <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
        <div className="pointer-events-none absolute -left-16 -top-24 size-64 rounded-full bg-halo/30 blur-3xl animate-drift" />
        <div className="pointer-events-none absolute -right-20 top-64 size-72 rounded-full bg-halo2/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-40 size-60 rounded-full bg-halo3/20 blur-3xl" />

        <div
          className={`relative mx-auto flex min-h-screen w-full ${wide ? "max-w-[760px]" : "max-w-[430px]"} flex-col px-5 pb-8 pt-3.5`}
        >
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
      </div>
    </SiteGate>
  );
}
