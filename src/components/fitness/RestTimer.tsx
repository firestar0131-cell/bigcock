import { useEffect, useState } from "react";
import { remainingRest, type RestTimer as Timer } from "@/lib/fitness/model";
import { secondary } from "./shared";

export function RestTimer({ timer, onChange }: { timer: Timer; onChange: (timer: Timer) => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [timer.endsAt]);
  const seconds = remainingRest(timer, now);
  return (
    <aside
      className="sticky top-2 z-10 rounded-2xl border border-halo/40 bg-paper/95 p-3 shadow-md backdrop-blur-xl"
      aria-label="休息計時器"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">休息 · {timer.exerciseName}</p>
          <p className="text-xs" role="status">
            {seconds > 0 ? "準備好就可略過，開始下一組" : "休息已結束，準備下一組"}
          </p>
        </div>
        <span
          role="timer"
          aria-label="剩餘休息時間"
          className="font-mono text-2xl font-bold tabular-nums"
        >
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          className={secondary}
          onClick={() =>
            onChange({ ...timer, endsAt: Math.max(Date.now(), timer.endsAt ?? 0) + 30000 })
          }
        >
          +30 秒
        </button>
        <button className={secondary} onClick={() => onChange({ ...timer, endsAt: null })}>
          略過
        </button>
        <button
          className={secondary}
          onClick={() => onChange({ ...timer, endsAt: Date.now() + timer.durationSeconds * 1000 })}
        >
          重新開始
        </button>
      </div>
    </aside>
  );
}
