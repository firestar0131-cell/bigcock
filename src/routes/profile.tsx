import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { analyzeProfileTargets } from "@/lib/gemini";
import {
  ACTIVITY_LABELS,
  DEFAULT_PROFILE,
  GOAL_LABELS,
  loadApiKey,
  loadProfile,
  loadTargets,
  saveGoal,
  saveProfile,
  saveTargets,
  type Profile,
  type Targets,
} from "@/lib/nutrition";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "個人資料 — 燃數 BURNLOG" },
      {
        name: "description",
        content: "輸入身高體重、運動量與目標，讓 AI 為你計算每日熱量與營養素建議。",
      },
      { property: "og:title", content: "個人資料 — 燃數 BURNLOG" },
      {
        property: "og:description",
        content: "AI 依你的身高體重與運動量計算每日熱量與 PFC 目標。",
      },
    ],
  }),
  component: ProfilePage,
});

const cardCls = "mt-3 animate-rise rounded-2xl bg-card p-4 ring-1 ring-white/50 backdrop-blur-xl";
const labelCls = "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
const inputCls =
  "mt-2 w-full rounded-lg bg-ink/5 px-3 py-2.5 font-disp text-lg font-extrabold tabular-nums outline-none focus:ring-1 focus:ring-halo";

function ProfilePage() {
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setP(loadProfile());
    setTargets(loadTargets());
  }, []);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    saveProfile(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function runAI() {
    setError("");
    const apiKey = loadApiKey();
    if (!apiKey) {
      setError("尚未設定 Gemini API Key，請到「設定」頁面輸入。");
      return;
    }
    saveProfile(p);
    setLoading(true);
    try {
      const summary = [
        `性別：${p.gender === "male" ? "男" : "女"}`,
        `年齡：${p.age} 歲`,
        `身高：${p.height} 公分`,
        `體重：${p.weight} 公斤`,
        `運動量：${ACTIVITY_LABELS[p.activity]}`,
        `目標：${GOAL_LABELS[p.goalType]}`,
        `目標體重：${p.targetWeight} 公斤`,
        p.note.trim() ? `其他備註：${p.note.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const r = await analyzeProfileTargets({ apiKey, summary });
      const t: Targets = { ...r, updatedAt: Date.now() };
      setTargets(t);
      saveTargets(t);
      saveGoal(t.kcal > 0 ? t.kcal : 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失敗，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mt-4 font-disp text-2xl font-black tracking-tight">個人資料</h1>
      <p className="mt-1 text-[11px] text-muted">
        填寫基本資料，讓 AI 幫你算出每日該吃多少熱量與營養素。
      </p>

      <section className={cardCls}>
        <span className={labelCls}>性別</span>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set("gender", g)}
              className={`rounded-lg py-2 text-sm transition ${
                p.gender === g ? "bg-ink text-paper font-medium" : "bg-ink/5 text-muted"
              }`}
            >
              {g === "male" ? "男性" : "女性"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <span className={labelCls}>年齡</span>
            <input
              type="number"
              inputMode="numeric"
              value={p.age}
              onChange={(e) => set("age", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <span className={labelCls}>身高 cm</span>
            <input
              type="number"
              inputMode="decimal"
              value={p.height}
              onChange={(e) => set("height", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <span className={labelCls}>體重 kg</span>
            <input
              type="number"
              inputMode="decimal"
              value={p.weight}
              onChange={(e) => set("weight", Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <section className={cardCls}>
        <span className={labelCls}>每週運動量</span>
        <div className="mt-2 flex flex-col gap-1.5">
          {(Object.keys(ACTIVITY_LABELS) as Array<Profile["activity"]>).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => set("activity", a)}
              className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                p.activity === a ? "bg-ink text-paper font-medium" : "bg-ink/5 text-muted"
              }`}
            >
              {ACTIVITY_LABELS[a]}
            </button>
          ))}
        </div>
      </section>

      <section className={cardCls}>
        <span className={labelCls}>目標</span>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(Object.keys(GOAL_LABELS) as Array<Profile["goalType"]>).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set("goalType", g)}
              className={`rounded-lg py-2 text-sm transition ${
                p.goalType === g ? "bg-ink text-paper font-medium" : "bg-ink/5 text-muted"
              }`}
            >
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <span className={labelCls}>目標體重 kg</span>
          <input
            type="number"
            inputMode="decimal"
            value={p.targetWeight}
            onChange={(e) => set("targetWeight", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div className="mt-3">
          <span className={labelCls}>其他備註（選填）</span>
          <textarea
            value={p.note}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            placeholder="例如：素食、乳糖不耐、想在三個月內達標"
            className="mt-2 w-full resize-none rounded-lg bg-ink/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-halo"
          />
        </div>
      </section>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          className="flex-1 rounded-xl bg-ink/5 py-3 font-disp text-sm font-bold tracking-tight transition active:scale-[0.99]"
        >
          {saved ? "已儲存" : "儲存資料"}
        </button>
        <button
          type="button"
          onClick={runAI}
          disabled={loading}
          className="flex-1 rounded-xl bg-ink py-3 font-disp text-sm font-bold tracking-tight text-paper transition active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? "AI 計算中…" : "AI 分析建議"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-600">{error}</p>
      ) : null}

      {targets ? (
        <section className={cardCls}>
          <div className="flex items-end justify-between">
            <span className={labelCls}>AI 每日建議</span>
            <span className="font-mono text-[10px] text-muted">已套用至今日頁面</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-disp text-[40px] font-black leading-none tabular-nums tracking-tight">
              {targets.kcal.toLocaleString()}
            </span>
            <span className="font-mono text-sm text-muted">kcal / 天</span>
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-ink/10">
            {[
              { k: "蛋白質", v: targets.protein },
              { k: "脂肪", v: targets.fat },
              { k: "碳水", v: targets.carbs },
            ].map((m, i) => (
              <div key={m.k} className={i === 0 ? "pr-2" : i === 1 ? "px-2" : "pl-2"}>
                <div className="font-mono text-[10px] tracking-widest text-muted">{m.k}</div>
                <div className="mt-0.5">
                  <span className="font-disp text-2xl font-extrabold tabular-nums">{m.v}</span>{" "}
                  <span className="font-mono text-[10px] text-muted">g</span>
                </div>
              </div>
            ))}
          </div>
          {targets.advice ? (
            <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2.5 text-[12px] leading-relaxed">
              {targets.advice}
            </p>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
