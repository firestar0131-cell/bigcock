import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadApiKey, loadGoal, saveApiKey, saveGoal } from "@/lib/nutrition";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定 — 燃數 BURNLOG" },
      { name: "description", content: "設定你的 Gemini API Key 與每日熱量目標。" },
      { property: "og:title", content: "設定 — 燃數 BURNLOG" },
      { property: "og:description", content: "設定 Gemini API Key 與每日熱量目標。" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [key, setKey] = useState("");
  const [goal, setGoal] = useState(2000);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setKey(loadApiKey());
    setGoal(loadGoal());
  }, []);

  function save() {
    saveApiKey(key);
    saveGoal(goal > 0 ? goal : 2000);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell>
      <h1 className="mt-4 font-disp text-2xl font-black tracking-tight">設定</h1>

      <section className="mt-4 animate-rise rounded-2xl bg-card p-4 ring-1 ring-white/50 backdrop-blur-xl">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Gemini API Key
        </label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="貼上你的 API Key"
          className="mt-2 w-full rounded-lg bg-ink/5 px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-halo"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          金鑰只會存在這台裝置的瀏覽器中，不會上傳。可於 Google AI Studio 免費申請。
        </p>
      </section>

      <section className="mt-3 animate-rise rounded-2xl bg-card p-4 ring-1 ring-white/50 backdrop-blur-xl">
        <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          每日熱量目標（kcal）
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={goal}
          onChange={(e) => setGoal(Number(e.target.value))}
          className="mt-2 w-full rounded-lg bg-ink/5 px-3 py-2.5 font-disp text-lg font-extrabold tabular-nums outline-none focus:ring-1 focus:ring-halo"
        />
      </section>

      <button
        type="button"
        onClick={save}
        className="mt-4 w-full rounded-xl bg-ink py-3 font-disp text-sm font-bold tracking-tight text-paper transition active:scale-[0.99]"
      >
        {saved ? "已儲存" : "儲存設定"}
      </button>
    </AppShell>
  );
}
