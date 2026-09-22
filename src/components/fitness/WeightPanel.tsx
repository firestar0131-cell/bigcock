import type { FitnessUpdate } from "@/lib/fitness/sync";
import { useState } from "react";
import { subMonths } from "date-fns";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  localDate,
  shiftDate,
  validDate,
  weeklyTrend,
  type FitnessData,
  type WeightEntry,
} from "@/lib/fitness/model";
import { card, input, primary, secondary, Confirm, Empty } from "./shared";

type Props = { data: FitnessData; update: FitnessUpdate };
export function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const [range, setRange] = useState("4w");
  const today = localDate();
  const cutoff =
    range === "all"
      ? "0000-01-01"
      : range === "4w"
        ? shiftDate(today, -27)
        : localDate(subMonths(new Date(`${today}T12:00:00`), 3));
  const measurements = entries
    .filter((e) => e.date >= cutoff && e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weekly = weeklyTrend(entries.filter((e) => e.date <= today));
  const points = new Map<
    string,
    {
      date: string;
      timestamp: number;
      weight: number | null;
      average: number | null;
      count?: number;
    }
  >();
  for (const e of measurements)
    points.set(e.date, {
      date: e.date,
      timestamp: new Date(`${e.date}T12:00:00`).getTime(),
      weight: e.weight,
      average: null,
    });
  // Include empty calendar weeks as explicit nulls so the average line never bridges missing weeks.
  if (measurements.length) {
    const firstWeek = weekly.find((w) => shiftDate(w.date, 6) >= cutoff)?.date;
    for (let date = firstWeek ?? today; date <= today; date = shiftDate(date, 7)) {
      const week = weekly.find((w) => w.date === date);
      const displayDate = date < cutoff ? cutoff : date;
      const existing = points.get(displayDate);
      points.set(displayDate, {
        date: displayDate,
        timestamp: new Date(`${displayDate}T12:00:00`).getTime(),
        weight: existing?.weight ?? null,
        average: week?.average ?? null,
        count: week?.count ?? 0,
      });
    }
  }
  const chart = [...points.values()].sort((a, b) => a.timestamp - b.timestamp);
  const averages = chart.filter((p) => p.count !== undefined);
  return (
    <section className={`${card} space-y-4`} aria-label="體重趨勢圖">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">體重趨勢</h2>
        <div className="flex gap-1">
          {[
            ["4w", "4 週"],
            ["3m", "3 個月"],
            ["all", "全部"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`${secondary} ${range === value ? "!bg-ink !text-paper" : ""}`}
              aria-pressed={range === value}
              onClick={() => setRange(value!)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!measurements.length ? (
        <Empty>尚無這段期間的量測紀錄，新增第一筆體重開始追蹤。</Empty>
      ) : (
        <>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  domain={
                    chart.length === 1
                      ? [chart[0]!.timestamp - 43200000, chart[0]!.timestamp + 43200000]
                      : ["dataMin", "dataMax"]
                  }
                  {...(chart.length === 1 ? { ticks: [chart[0]!.timestamp] } : {})}
                  minTickGap={24}
                  scale="time"
                  tickFormatter={(v) => localDate(new Date(v)).slice(5)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={66} unit="kg" />
                <Tooltip
                  labelFormatter={(v) => localDate(new Date(Number(v)))}
                  formatter={(v: number, name: string) => [`${v.toFixed(2)} kg`, name]}
                />
                <Line
                  data={chart}
                  dataKey="weight"
                  name="單次量測"
                  stroke="#287b9b"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                  type="linear"
                  isAnimationActive={false}
                />
                <Line
                  data={averages}
                  dataKey="average"
                  name="週平均"
                  stroke="#6653bc"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 5 }}
                  connectNulls={false}
                  type="linear"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            藍色：單次量測；紫色虛線：週一至週日的實際紀錄平均（本週尚未結束）。空白週不連線；僅一筆時只顯示點。
          </p>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3">查看週平均數據</summary>
            <ul className="space-y-2">
              {weekly
                .filter((w) => shiftDate(w.date, 6) >= cutoff)
                .map((w) => (
                  <li key={w.date}>
                    {w.date} 起：{w.average.toFixed(2)} kg（{w.count} 筆）
                  </li>
                ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

export function WeightPanel({ data, update }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(localDate);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  function reset() {
    setEditing(null);
    setDate(localDate());
    setWeight("");
    setNote("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMessage("");
    const value = Number(weight);
    if (
      !validDate(date) ||
      date > localDate() ||
      !weight.trim() ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 500
    ) {
      setMessage("請輸入有效日期及 0–500 kg 之間的體重（不含 0）。");
      return;
    }
    if (data.weights.some((e) => e.date === date && e.id !== editing)) {
      setMessage("這一天已有紀錄，請編輯該筆，避免重複量測影響週平均。");
      return;
    }
    const entry: WeightEntry = {
      id: editing ?? crypto.randomUUID(),
      date,
      weight: value,
      note: note.trim(),
    };
    setSaving(true);
    if (
      await update((d) => ({
        ...d,
        weights: [...d.weights.filter((e) => e.id !== entry.id), entry],
      }))
    ) {
      reset();
      setMessage("體重已儲存至雲端。");
    } else setMessage("體重尚未儲存，請查看上方錯誤後重試。");
    setSaving(false);
  }
  return (
    <div className="space-y-4">
      <form onSubmit={save} className={`${card} space-y-3`}>
        <h2 className="font-bold">{editing ? "編輯體重" : "記錄體重"}</h2>
        <label className="block text-sm">
          體重 kg
          <input
            aria-label="體重 kg"
            className={`${input} mt-1 text-2xl font-bold`}
            type="number"
            inputMode="decimal"
            min="0.01"
            max="500"
            step="any"
            required
            placeholder="56.2"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          日期
          <input
            className={`${input} mt-1`}
            type="date"
            required
            max={localDate()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          備註（選填）
          <input
            className={`${input} mt-1`}
            value={note}
            maxLength={500}
            placeholder="例如：起床後量測"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button className={`${primary} flex-1`} type="submit" disabled={saving}>
            儲存體重
          </button>
          {editing && (
            <button className={secondary} type="button" onClick={reset}>
              取消編輯
            </button>
          )}
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
      <WeightChart entries={data.weights} />
      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">體重歷史</h2>
        {!data.weights.length && <Empty>不必每天量測，有紀錄就能計算平均。</Empty>}
        {[...data.weights]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((e) => (
            <article key={e.id} className="border-t border-ink/10 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">{e.date}</p>
                  <p className="font-disp text-xl font-bold">{e.weight} kg</p>
                </div>
                <div className="flex gap-1">
                  <button
                    className={secondary}
                    aria-label={`編輯 ${e.date} 體重`}
                    onClick={() => {
                      setEditing(e.id);
                      setDate(e.date);
                      setWeight(String(e.weight));
                      setNote(e.note);
                      setMessage("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    編輯
                  </button>
                  <Confirm
                    title="刪除體重紀錄？"
                    description={`${e.date} 的 ${e.weight} kg 將被刪除，週平均會重新計算。`}
                    destructive
                    onConfirm={async () => {
                      if (
                        (await update((d) => ({
                          ...d,
                          weights: d.weights.filter((w) => w.id !== e.id),
                        }))) &&
                        editing === e.id
                      )
                        reset();
                    }}
                  >
                    <button
                      className={`${secondary} text-destructive`}
                      aria-label={`刪除 ${e.date} 體重`}
                    >
                      刪除
                    </button>
                  </Confirm>
                </div>
              </div>
              {e.note && <p className="mt-2 break-words text-sm text-muted">{e.note}</p>}
            </article>
          ))}
      </section>
    </div>
  );
}

