import { LegacyImport } from "@/components/fitness/LegacyImport";
import type { FitnessUpdate } from "@/lib/fitness/sync";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { FitnessAccount } from "@/components/fitness/FitnessAccount";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { WeightPanel, WeightChart } from "@/components/fitness/WeightPanel";
import { WorkoutPanel } from "@/components/fitness/WorkoutPanel";
import { ProgressPanel } from "@/components/fitness/ProgressPanel";
import { card, input, primary, secondary, Stat } from "@/components/fitness/shared";
import { useFitness } from "@/hooks/use-fitness";
import { useProgressPhotos } from "@/hooks/use-progress-photos";
import { LatestPhoto, ProgressPhotos } from "@/components/fitness/ProgressPhotos";
import { GAIN_RATE, localDate, weeklySummary, type FitnessData } from "@/lib/fitness/model";

export const Route = createFileRoute("/fitness")({
  head: () => ({
    meta: [
      { title: "健身與增肌追蹤 — 燃數 BURNLOG" },
      { name: "description", content: "記錄體重趨勢、每組訓練與動作進步，隨時參考上次表現。" },
    ],
  }),
  component: FitnessPage,
});
const tabs = [
  { id: "overview", label: "總覽" },
  { id: "workout", label: "訓練" },
  { id: "weight", label: "體重" },
  { id: "progress", label: "進步" },
] as const;
type Tab = (typeof tabs)[number]["id"];

function FitnessPage() {
  return <FitnessAccount>{(user) => <FitnessContent key={user.id} user={user} />}</FitnessAccount>;
}
function FitnessContent({ user }: { user: User }) {
  const { data, ready, error, update, pending, reload } = useFitness(user.id);
  const [tab, setTab] = useState<Tab>("overview");
  const photos = useProgressPhotos(user.id);
  return (
    <AppShell wide>
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted">
            FITNESS / MUSCLE GAIN
          </p>
          <h1 className="mt-1 font-disp text-2xl font-black sm:text-3xl">每一組，都算數。</h1>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-halo/20 px-3 py-2 text-xs font-bold">
          健身
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">記錄體重，延續上次的進步。</p>
      <div
        role="tablist"
        aria-label="健身分頁"
        className="my-5 grid grid-cols-4 gap-1 rounded-2xl bg-ink/5 p-1"
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`min-h-12 rounded-xl text-sm font-bold ${tab === t.id ? "bg-ink text-paper shadow-sm" : "text-muted"}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (i + 1) % tabs.length
                  : e.key === "ArrowLeft"
                    ? (i + tabs.length - 1) % tabs.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : null;
              if (next !== null) {
                e.preventDefault();
                const target = tabs[next]!;
                setTab(target.id);
                document.getElementById(`tab-${target.id}`)?.focus();
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mb-4 space-y-2 rounded-xl bg-ink/5 p-3 text-sm">
        <p className="break-all">{user.email}</p>
        <p role="status">
          {pending ? `正在儲存至雲端（${pending}）…` : ready ? "已儲存至雲端" : "雲端資料尚未就緒"}
        </p>
        <button className={secondary} disabled={pending > 0} onClick={reload}>
          重新載入雲端資料
        </button>
        <button
          className={`${secondary} ml-2`}
          disabled={pending > 0 || photos.busy}
          onClick={async () => {
            const result = await supabase.auth.signOut();
            if (result.error) window.alert("登出失敗，請重試。");
          }}
        >
          登出
        </button>
      </div>
      {ready && (
        <LegacyImport
          userId={user.id}
          update={update}
          reloadPhotos={photos.reload}
          disabled={pending > 0 || photos.busy}
        />
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!ready ? (
        <p className="text-sm text-muted">
          {error ? "資料尚未就緒，暫停寫入。" : "正在讀取健身紀錄…"}
        </p>
      ) : (
        <>
          {data.draft && tab !== "workout" && (
            <button className={`${primary} mb-4 w-full`} onClick={() => setTab("workout")}>
              繼續 {data.draft.name} · 未完成訓練已保存
            </button>
          )}
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "overview" && (
              <>
                <div className="mb-4">
                  <LatestPhoto state={photos} onOpen={() => setTab("progress")} />
                </div>
                <Overview data={data} update={update} go={setTab} />
              </>
            )}
            {tab === "weight" && <WeightPanel data={data} update={update} />}
            {tab === "workout" && <WorkoutPanel data={data} update={update} />}
            {tab === "progress" && (
              <div className="space-y-5">
                <button className={`${secondary} w-full`} onClick={() => setTab("weight")}>
                  ＋ 快速記錄體重（不需照片）
                </button>
                <ProgressPhotos state={photos} weights={data.weights} />
                <ProgressPanel data={data} />
              </div>
            )}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted">
            紀錄保存在 Supabase
            帳號中。請等待「已儲存至雲端」後再離開；其他裝置登入同一帳號即可取得資料。
          </p>
        </>
      )}
    </AppShell>
  );
}

function Overview({
  data,
  update,
  go,
}: {
  data: FitnessData;
  update: FitnessUpdate;
  go: (tab: Tab) => void;
}) {
  const summary = weeklySummary(data.weights);
  const latest = [...data.weights]
    .filter((w) => w.date <= localDate())
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const [target, setTarget] = useState(String(data.goal.targetWeight));
  const [saved, setSaved] = useState(false);
  const statuses = {
    insufficient: "資料不足，尚無兩週可比較",
    below: "低於目標範圍",
    within: "在目標範圍內",
    above: "高於目標範圍",
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="最新體重"
          value={latest ? `${latest.weight} kg` : "尚無紀錄"}
          detail={latest?.date ?? "新增第一筆量測"}
        />
        <Stat
          label="第一階段目標"
          value={`${data.goal.targetWeight} kg`}
          detail={`起始 ${data.goal.startingWeight} kg · 身高 ${data.goal.height} cm`}
        />
        <Stat
          label="最近 7 天平均"
          value={summary.currentAverage === null ? "—" : `${summary.currentAverage.toFixed(2)} kg`}
          detail={`${summary.currentStart}–${summary.today} · ${summary.currentCount} 筆`}
        />
        <Stat
          label="前 7 天平均"
          value={
            summary.previousAverage === null ? "—" : `${summary.previousAverage.toFixed(2)} kg`
          }
          detail={`${summary.previousStart} 起 · ${summary.previousCount} 筆`}
        />
      </div>
      <section className={`${card} space-y-2`}>
        <p className="text-xs text-muted">兩週平均差</p>
        <p className="font-disp text-3xl font-black">
          {summary.change === null
            ? "—"
            : `${summary.change >= 0 ? "+" : ""}${summary.change.toFixed(2)} kg`}
        </p>
        <p className="font-bold">{statuses[summary.status]}</p>
        <p className="text-xs leading-relaxed text-muted">
          增重期望 {GAIN_RATE.desiredMin}–{GAIN_RATE.desiredMax} kg／週；狀態參考範圍{" "}
          {GAIN_RATE.below.toFixed(2)}–{GAIN_RATE.above.toFixed(2)}{" "}
          kg／週。僅平均實際量測，不補齊未量測日；筆數少時請謹慎解讀。
        </p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <button className={primary} onClick={() => go("weight")}>
          ＋ 記錄體重
        </button>
        <button className={secondary} onClick={() => go("workout")}>
          {data.draft ? "繼續訓練" : "開始訓練"}
        </button>
      </div>
      <WeightChart entries={data.weights} />
      <section className={`${card} space-y-2`}>
        <h2 className="font-bold">訓練摘要</h2>
        <p className="text-sm">
          最近 7 天完成{" "}
          {
            data.sessions.filter((s) => s.date >= summary.currentStart && s.date <= summary.today)
              .length
          }{" "}
          次訓練
        </p>
        <p className="text-sm text-muted">
          {[...data.sessions].sort(
            (a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt,
          )[0]?.name ?? "尚無完成訓練"}
          {data.draft ? ` · ${data.draft.name} 進行中` : ""}
        </p>
      </section>
      <form
        className={`${card} space-y-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          const value = Number(target);
          if (
            Number.isFinite(value) &&
            value > 0 &&
            value <= 500 &&
            (await update((d) => ({ ...d, goal: { ...d.goal, targetWeight: value } })))
          )
            setSaved(true);
        }}
      >
        <h2 className="font-bold">增肌目標</h2>
        <label className="block text-sm">
          目標體重 kg
          <input
            className={`${input} mt-1`}
            type="number"
            min="0.01"
            max="500"
            step="any"
            inputMode="decimal"
            required
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <button className={secondary} type="submit">
          儲存目標
        </button>
        {saved && (
          <p role="status" className="text-sm">
            目標已儲存。
          </p>
        )}
      </form>
    </div>
  );
}

