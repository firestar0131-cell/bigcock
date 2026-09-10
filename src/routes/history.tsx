import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  formatTime,
  loadMeals,
  mealLabel,
  saveMeals,
  sumMacros,
  type MealEntry,
} from "@/lib/nutrition";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "歷史紀錄 — 燃數 BURNLOG" },
      { name: "description", content: "回顧每日餐點紀錄與熱量、蛋白質、脂肪、碳水攝取。" },
      { property: "og:title", content: "歷史紀錄 — 燃數 BURNLOG" },
      { property: "og:description", content: "回顧每日餐點紀錄與熱量與 PFC 攝取。" },
    ],
  }),
  component: History,
});

function dayKey(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function History() {
  const [meals, setMeals] = useState<MealEntry[]>([]);

  useEffect(() => {
    setMeals(loadMeals());
  }, []);

  function remove(id: string) {
    const next = meals.filter((m) => m.id !== id);
    setMeals(next);
    saveMeals(next);
  }

  const groups = meals
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .reduce<Record<string, MealEntry[]>>((acc, m) => {
      const k = dayKey(m.createdAt);
      (acc[k] ||= []).push(m);
      return acc;
    }, {});

  return (
    <AppShell>
      <h1 className="mt-4 font-disp text-2xl font-black tracking-tight">歷史紀錄</h1>

      {meals.length === 0 && (
        <p className="mt-4 rounded-xl bg-card p-4 text-center text-xs text-muted ring-1 ring-white/50 backdrop-blur-xl">
          還沒有任何紀錄。
        </p>
      )}

      <div className="mt-4 space-y-5">
        {Object.entries(groups).map(([day, items]) => {
          const t = sumMacros(items);
          return (
            <section key={day} className="animate-rise">
              <div className="flex items-baseline justify-between px-1">
                <span className="font-mono text-[11px] text-muted">{day}</span>
                <span className="font-disp text-sm font-extrabold tabular-nums">
                  {t.kcal} kcal
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {items.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-white/50 backdrop-blur-xl"
                  >
                    {m.image ? (
                      <img
                        src={m.image}
                        alt={m.title}
                        className="size-11 shrink-0 rounded-lg object-cover outline-1 -outline-offset-1 outline-black/5"
                      />
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink/5 font-mono text-[9px] text-muted">
                        TXT
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{m.title}</div>
                      <div className="font-mono text-[10px] text-muted">
                        {mealLabel(m.createdAt)} · {formatTime(m.createdAt)} · P {m.protein} / F{" "}
                        {m.fat} / C {m.carbs}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-disp text-base font-extrabold tabular-nums">
                        {m.totalKcal}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        className="font-mono text-[10px] text-destructive"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
