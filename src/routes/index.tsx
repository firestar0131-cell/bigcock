import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MacroPie } from "@/components/MacroPie";
import { analyzeMeal, fileToBase64 } from "@/lib/gemini";
import { supabase } from "@/integrations/supabase/client";
import {
  formatTime,
  isToday,
  loadApiKey,
  loadGoal,
  loadMeals,
  loadTargets,
  mealLabel,
  saveMeals,
  sumMacros,
  type Analysis,
  type MealEntry,
  type Targets,
} from "@/lib/nutrition";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "燃數 BURNLOG — AI 飲食與體態紀錄" },
      {
        name: "description",
        content: "拍照或輸入文字，AI 立即拆解食材熱量；私密記錄每日體態與體重變化。",
      },
      { property: "og:title", content: "燃數 BURNLOG — AI 飲食與體態紀錄" },
      {
        property: "og:description",
        content: "拍照或輸入文字，AI 立即拆解食材熱量與 PFC，掌握每日熱量目標。",
      },
    ],
  }),
  component: Today,
});

interface BodyLog {
  id: string;
  weight: number | null;
  photo_path: string;
  recorded_at: string;
  imageUrl?: string;
}

function Today() {
  // 分頁切換狀態: 'diet' 為飲食記錄, 'body' 為體態追蹤
  const [activeTab, setActiveTab] = useState<"diet" | "body">("diet");

  // 飲食紀錄相關狀態
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [goal, setGoal] = useState(2000);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ base64: string; dataUrl: string; mime: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

// 取得真正的本地當天日期 (YYYY-MM-DD)，避開 UTC 造成的時差偷跑昨天
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 取得或建立裝置專屬的合法 UUID（徹底解決 invalid input syntax for type uuid）
  const getLocalUserId = () => {
    if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
    let id = localStorage.getItem("burnlog_user_uuid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("burnlog_user_uuid", id);
    }
    return id;
  };

  // 體態追蹤相關狀態
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyDate, setBodyDate] = useState(getTodayString());
  const [bodyFile, setBodyFile] = useState<File | null>(null);
  const [bodyPreviewUrl, setBodyPreviewUrl] = useState<string | null>(null);
  const [bodyUploading, setBodyUploading] = useState(false);
  const [bodyMessage, setBodyMessage] = useState("");
  const bodyCameraRef = useRef<HTMLInputElement>(null);
  const bodyGalleryRef = useRef<HTMLInputElement>(null);

  // 讀取私人體態相片（生成具時效保護的 Signed URL，絕不外流）
  async function fetchBodyLogs() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      let query = supabase.from("body_logs").select("*").order("recorded_at", { ascending: false });
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error: dbErr } = await query;
      if (dbErr) throw dbErr;

      if (data) {
        const logsWithUrls = await Promise.all(
          data.map(async (log: any) => {
            const { data: signedData } = await supabase.storage
              .from("body-photos")
              .createSignedUrl(log.photo_path, 3600);
            return { ...log, imageUrl: signedData?.signedUrl || "" };
          })
        );
        setBodyLogs(logsWithUrls);
      }
    } catch (e) {
      console.warn("尚未建立登入連線或體態資料尚未載入:", e);
    }
  }

  // 體態上傳邏輯（純私密儲存，完全跳過 AI）
  async function handleBodyUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyFile) {
      setBodyMessage("請先選擇一張體態照片！");
      return;
    }
    setBodyUploading(true);
    setBodyMessage("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || "anonymous-user";
      const fileExt = bodyFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      // 1. 直傳私密儲存空間
      const { error: uploadErr } = await supabase.storage
        .from("body-photos")
        .upload(filePath, bodyFile);

      if (uploadErr) throw uploadErr;

      // 2. 寫入 body_logs 表格
      const { error: insertErr } = await supabase.from("body_logs").insert([
        {
          user_id: userId,
          weight: bodyWeight ? parseFloat(bodyWeight) : null,
          photo_path: filePath,
          recorded_at: bodyDate,
        },
      ]);

      if (insertErr) throw insertErr;

      setBodyMessage("體態記錄儲存成功！");
      setBodyFile(null);
      setBodyWeight("");
      if (bodyFileRef.current) bodyFileRef.current.value = "";
      fetchBodyLogs();
    } catch (err: any) {
      setBodyMessage(err.message || "上傳失敗，請確認 Supabase 設定。");
    } finally {
      setBodyUploading(false);
    }
  }

  const todayMeals = meals.filter((m) => isToday(m.createdAt));
  const totals = sumMacros(todayMeals);
  const pct = Math.min(100, Math.round((totals.kcal / goal) * 100));
  const remain = Math.max(0, goal - totals.kcal);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { base64, dataUrl } = await fileToBase64(file);
    setImage({ base64, dataUrl, mime: file.type });
  }

  async function run() {
    const apiKey = loadApiKey();
    setError("");
    if (!apiKey) {
      setError("尚未設定 Gemini API Key，請到「設定」頁面輸入。");
      return;
    }
    if (!text.trim() && !image) {
      setError("請上傳照片或輸入餐點文字。");
      return;
    }
    setLoading(true);
    try {
      const analysis = await analyzeMeal({
        apiKey,
        text,
        imageBase64: image?.base64,
        mimeType: image?.mime,
      });
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失敗，請再試一次。");
    } finally {
      setLoading(false);
    }
  }

  function confirmRecord() {
    if (!result) return;
    const entry: MealEntry = {
      ...result,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      image: image?.dataUrl,
    };
    const next = [entry, ...meals];
    setMeals(next);
    saveMeals(next);
    setResult(null);
    setText("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove(id: string) {
    const next = meals.filter((m) => m.id !== id);
    setMeals(next);
    saveMeals(next);
  }

  return (
    <AppShell>
      {/* 頂部切換頁籤 */}
      <div className="mt-2 flex rounded-2xl bg-ink/5 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("diet")}
          className={`flex-1 rounded-xl py-2 font-disp text-xs font-bold transition ${
            activeTab === "diet"
              ? "bg-card text-foreground shadow-sm ring-1 ring-white/60"
              : "text-muted hover:text-foreground"
          }`}
        >
          飲食與熱量
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("body")}
          className={`flex-1 rounded-xl py-2 font-disp text-xs font-bold transition ${
            activeTab === "body"
              ? "bg-card text-foreground shadow-sm ring-1 ring-white/60"
              : "text-muted hover:text-foreground"
          }`}
        >
          體態追蹤 (私密)
        </button>
      </div>

      {/* 頁籤一：飲食紀錄 */}
      {activeTab === "diet" && (
        <>
          <section className="mt-4 animate-rise rounded-2xl bg-card p-4 ring-1 ring-white/50 backdrop-blur-xl">
            <div className="flex items-end justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                今日熱量 / TODAY
              </span>
              <span className="font-mono text-[10px] text-muted">目標 {goal}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-disp text-[46px] font-black leading-none tabular-nums tracking-tight">
                {totals.kcal.toLocaleString()}
              </span>
              <span className="font-mono text-sm text-muted">/ {goal} kcal</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg,var(--color-halo),var(--color-halo2))",
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
              <span>已攝取 {pct}%</span>
              <span>剩餘 {remain}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-ink/10">
              {[
                { k: "蛋白質", v: totals.protein, t: targets?.protein },
                { k: "脂肪", v: totals.fat, t: targets?.fat },
                { k: "碳水", v: totals.carbs, t: targets?.carbs },
              ].map((m, i) => (
                <div key={m.k} className={i === 0 ? "pr-2" : i === 1 ? "px-2" : "pl-2"}>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {m.k}
                  </div>
                  <div className="mt-0.5">
                    <span className="font-disp text-2xl font-extrabold tabular-nums">
                      {Math.round(m.v)}
                    </span>{" "}
                    <span className="font-mono text-[10px] text-muted">
                      {m.t ? `/ ${m.t} g` : "g"}
                    </span>
                  </div>
                  {m.t ? (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-ink/60 transition-all"
                        style={{ width: `${Math.min(100, Math.round((m.v / m.t) * 100))}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {targets?.advice ? (
              <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2 text-[11px] leading-relaxed text-muted">
                {targets.advice}
              </p>
            ) : null}
          </section>

          {!targets ? (
            <Link
              to="/profile"
              className="mt-3 flex animate-rise items-center justify-between rounded-2xl bg-card px-4 py-3 ring-1 ring-white/50 backdrop-blur-xl"
            >
              <span className="text-[12px]">填寫個人資料，讓 AI 算出你的每日目標</span>
              <span className="font-disp text-sm font-bold">→</span>
            </Link>
          ) : null}

          <div className="mt-3 flex items-center justify-between px-1">
            <h1 className="font-disp text-sm font-bold tracking-tight">已記錄餐點</h1>
            <span className="font-mono text-[10px] text-muted">{todayMeals.length} 餐</span>
          </div>

          <div className="mt-2 space-y-2">
            {todayMeals.length === 0 && (
              <p className="rounded-xl bg-card p-4 text-center text-xs text-muted ring-1 ring-white/50 backdrop-blur-xl">
                今天還沒有紀錄，從下方拍照或輸入開始。
              </p>
            )}
            {todayMeals.map((m) => (
              <div
                key={m.id}
                className="animate-rise rounded-xl bg-card p-3 ring-1 ring-white/50 backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  className="flex w-full items-center gap-3 text-left"
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.title}</span>
                    <span className="block font-mono text-[10px] text-muted">
                      {mealLabel(m.createdAt)} · {formatTime(m.createdAt)}
                    </span>
                  </span>
                  <span className="font-disp text-base font-extrabold tabular-nums">
                    {m.totalKcal}
                  </span>
                </button>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-[10px]">
                    P {m.protein}g
                  </span>
                  <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-[10px]">
                    F {m.fat}g
                  </span>
                  <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-[10px]">
                    C {m.carbs}g
                  </span>
                </div>

                {openId === m.id && (
                  <div className="mt-3">
                    <div className="overflow-hidden rounded-xl ring-1 ring-ink/10">
                      <div className="flex items-center justify-between bg-ink/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
                        <span>食材清單</span>
                        <span>kcal · P/F/C</span>
                      </div>
                      <div className="divide-y divide-ink/5">
                        {m.ingredients.map((ing, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2">
                            <span className="text-xs font-medium">
                              {ing.name} {ing.amount}
                            </span>
                            <span className="flex gap-3 font-mono text-[10px] tabular-nums">
                              <span>{ing.kcal}</span>
                              <span className="text-muted">
                                {ing.protein} / {ing.fat} / {ing.carbs}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {m.comment && (
                      <p className="mt-2 rounded-lg bg-halo/10 px-3 py-2 text-[11px] leading-relaxed text-ink/80">
                        {m.comment}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="mt-2 w-full rounded-lg bg-ink/5 py-2 font-mono text-[11px] text-destructive"
                    >
                      刪除這筆紀錄
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <section className="mt-6 animate-rise rounded-2xl bg-paper/70 p-3 ring-1 ring-white/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink/5 outline-1 -outline-offset-1 outline-black/5"
              >
                {image ? (
                  <img src={image.dataUrl} alt="餐點照片" className="size-full object-cover" />
                ) : (
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
                    拍照
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={pickFile}
                className="hidden"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">新增餐點</div>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="拍照或輸入「雞胸肉100g 配生菜沙拉」"
                  className="mt-1 w-full rounded-lg bg-ink/5 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:ring-1 focus:ring-halo"
                />
              </div>
            </div>
            {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="mt-3 w-full rounded-xl bg-ink py-3 font-disp text-sm font-bold tracking-tight text-paper transition active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "AI 分析中…" : "AI 分析"}
            </button>
          </section>
        </>
      )}

      {/* 頁籤二：體態追蹤 */}
      {activeTab === "body" && (
        <div className="mt-4 space-y-4 animate-rise">
          <section className="rounded-2xl bg-card p-4 ring-1 ring-white/50 backdrop-blur-xl space-y-4">
            <div>
              <h2 className="font-disp text-base font-bold">記錄今日體態</h2>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                🔒 隱私保護：體態照片僅存於個人私密空間，絕不會傳送至任何 AI 服務。
              </p>
            </div>

            <form onSubmit={handleBodyUpload} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-muted mb-1">記錄日期</label>
                  <input
                    type="date"
                    value={bodyDate}
                    onChange={(e) => setBodyDate(e.target.value)}
                    className="w-full rounded-xl bg-ink/5 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-halo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-muted mb-1">體重 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="例如 68.5"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(e.target.value)}
                    className="w-full rounded-xl bg-ink/5 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-halo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-muted mb-1">體態照片</label>
                <input
                  ref={bodyFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBodyFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-ink/5 hover:file:bg-ink/10"
                  required
                />
              </div>

              {bodyMessage && (
                <p className="text-[11px] text-halo2 font-medium">{bodyMessage}</p>
              )}

              <button
                type="submit"
                disabled={bodyUploading}
                className="w-full rounded-xl bg-ink py-2.5 font-disp text-xs font-bold tracking-tight text-paper transition active:scale-[0.99] disabled:opacity-50"
              >
                {bodyUploading ? "正在上傳私人相簿..." : "儲存今日體態"}
              </button>
            </form>
          </section>

          {/* 歷史體態照片展示 */}
          <section className="space-y-2">
            <h3 className="font-disp text-xs font-bold tracking-tight px-1">歷史體態與體重</h3>
            {bodyLogs.length === 0 ? (
              <p className="rounded-xl bg-card p-4 text-center text-xs text-muted ring-1 ring-white/50">
                目前尚無體態紀錄，拍攝一張照片開始追蹤！
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {bodyLogs.map((item) => (
                  <div key={item.id} className="rounded-xl bg-card overflow-hidden ring-1 ring-white/50 backdrop-blur-xl">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="體態" className="w-full h-44 object-cover" />
                    ) : (
                      <div className="w-full h-44 grid place-items-center bg-ink/5 font-mono text-[10px] text-muted">
                        私密相片
                      </div>
                    )}
                    <div className="p-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-muted">{item.recorded_at}</span>
                      <span className="font-disp font-bold">{item.weight ? `${item.weight} kg` : "未記錄"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 分析彈出視窗 */}
      {result && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 backdrop-blur-[2px]">
          <div className="max-h-[88vh] w-full max-w-[430px] animate-rise overflow-y-auto rounded-t-3xl border-t border-white/60 bg-paper/95 p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2">
              <MacroPie
                protein={result.protein}
                fat={result.fat}
                carbs={result.carbs}
                size={20}
              />
              <span className="font-disp text-sm font-extrabold tracking-tight">AI 分析結果</span>
              <span className="ml-auto font-mono text-[10px] text-muted">GEMINI 2.5 FLASH</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{result.title}</p>

            <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-ink/10">
              <div className="flex items-center justify-between bg-ink/5 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
                <span>食材清單</span>
                <span>kcal · P/F/C</span>
              </div>
              <div className="divide-y divide-ink/5">
                {result.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium">
                      {ing.name} {ing.amount}
                    </span>
                    <span className="flex gap-3 font-mono text-[10px] tabular-nums">
                      <span>{ing.kcal}</span>
                      <span className="text-muted">
                        {ing.protein} / {ing.fat} / {ing.carbs}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <MacroPie protein={result.protein} fat={result.fat} carbs={result.carbs} />
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="font-disp text-3xl font-black leading-none tabular-nums">
                    {result.totalKcal}
                  </span>
                  <span className="font-mono text-xs text-muted">kcal 本餐</span>
                </div>
                <div className="mt-1 flex gap-2 font-mono text-[10px] text-muted">
                  <span>蛋白 {result.protein}g</span>
                  <span>脂肪 {result.fat}g</span>
                  <span>碳水 {result.carbs}g</span>
                </div>
              </div>
            </div>

            <p className="mt-3 rounded-lg bg-halo/10 px-3 py-2 text-[11px] leading-relaxed text-ink/80">
              {result.comment}
            </p>

            <button
              type="button"
              onClick={confirmRecord}
              className="mt-3 w-full rounded-xl bg-ink py-3 font-disp text-sm font-bold tracking-tight text-paper transition active:scale-[0.99]"
            >
              確認記錄
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-2 w-full rounded-xl bg-ink/5 py-2.5 font-mono text-[11px] text-muted"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
