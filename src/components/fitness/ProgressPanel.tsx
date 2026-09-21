import { useState } from "react";
import {
  LineChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DEFAULT_TEMPLATES,
  exerciseHistory,
  localDate,
  validSet,
  type FitnessData,
} from "@/lib/fitness/model";
import { card, input, Empty, Stat } from "./shared";

export function ProgressPanel({ data }: { data: FitnessData }) {
  const names = new Map<string, string>();
  DEFAULT_TEMPLATES.forEach((t) => t.exercises.forEach((e) => names.set(e.id, e.name)));
  data.templates.forEach((t) => t.exercises.forEach((e) => names.set(e.id, e.name)));
  data.sessions.forEach((s) =>
    s.exercises.forEach((e) => {
      if (!names.has(e.exerciseId)) names.set(e.exerciseId, e.name);
    }),
  );
  const [selected, setSelected] = useState("bench-press");
  const records = exerciseHistory(data.sessions, selected);
  const latestWeight = [...data.weights]
    .filter((w) => w.date <= localDate())
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const latest = records[0];
  const chart = [...records]
    .reverse()
    .map((r) => ({ id: r.session.id, date: r.session.date, volume: r.volume }));
  return (
    <div className="space-y-4">
      <section>
        <h2 className="mb-3 font-disp text-xl font-bold">增重進度</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="起始體重" value={`${data.goal.startingWeight} kg`} />
          <Stat
            label="目前體重"
            value={latestWeight ? `${latestWeight.weight} kg` : "尚無量測"}
            detail={latestWeight?.date}
          />
          <Stat label="第一階段目標" value={`${data.goal.targetWeight} kg`} />
          <Stat
            label="自起始變化"
            value={
              latestWeight
                ? `${latestWeight.weight - data.goal.startingWeight >= 0 ? "+" : ""}${(latestWeight.weight - data.goal.startingWeight).toFixed(2)} kg`
                : "—"
            }
          />
        </div>
      </section>
      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">主要動作近況</h2>
        {["squat", "bench-press", "lat-pulldown", "barbell-row"].map((id) => {
          const record = exerciseHistory(data.sessions, id)[0];
          return (
            <button
              key={id}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-ink/5 px-3 py-2 text-left"
              onClick={() => setSelected(id)}
            >
              <span className="text-sm font-bold">{names.get(id) ?? id}</span>
              <span className="text-right text-xs text-muted">
                {record
                  ? `${record.session.date} · ${record.volume.toLocaleString()} kg`
                  : "尚無紀錄"}
              </span>
            </button>
          );
        })}
      </section>
      <section className={`${card} space-y-4`}>
        <h2 className="font-disp text-xl font-bold">動作歷史與進步</h2>
        <label className="block text-sm">
          選擇動作
          <select
            className={`${input} mt-1`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {[...names].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {!latest ? (
          <Empty>完成這個動作的第一筆訓練後，就會顯示重量、次數與訓練量。</Empty>
        ) : (
          <>
            <div className="rounded-xl bg-halo/15 p-3">
              <p className="text-xs text-muted">最近一次 · {latest.session.date}</p>
              <p className="mt-1 font-bold">
                {latest.exercise.sets
                  .filter((s) => s.completed && validSet(s))
                  .map((s) => `${s.weight} kg × ${s.reps}`)
                  .join(" ／ ")}
              </p>
              <p className="mt-2 text-sm">總訓練量 {latest.volume.toLocaleString()} kg</p>
            </div>
            {records.length > 1 ? (
              <div className="h-60 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="id"
                      tickFormatter={(id) => chart.find((c) => c.id === id)?.date.slice(5) ?? ""}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={55} />
                    <Tooltip
                      labelFormatter={(id) => chart.find((c) => c.id === id)?.date ?? ""}
                      formatter={(v: number) => [`${v.toLocaleString()} kg`, "總訓練量"]}
                    />
                    <Line
                      dataKey="volume"
                      stroke="#287b9b"
                      strokeWidth={2}
                      type="linear"
                      dot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty>目前只有一次紀錄，累積兩次以上才顯示趨勢。</Empty>
            )}
            <p className="text-xs leading-relaxed text-muted">
              訓練量＝已完成各組的重量 × 次數加總。徒手 0 kg
              不含體重，圖表只呈現外加負重，不判定肌肉增長。
            </p>
            {records.map((r) => (
              <article key={r.session.id} className="border-t border-ink/10 pt-3">
                <p className="text-sm font-bold">
                  {r.session.date} · {r.session.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {r.exercise.sets
                    .filter((s) => s.completed && validSet(s))
                    .map((s) => `${s.weight} kg × ${s.reps}`)
                    .join(" ／ ")}
                </p>
                <p className="mt-1 text-sm">Volume：{r.volume.toLocaleString()} kg</p>
              </article>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
