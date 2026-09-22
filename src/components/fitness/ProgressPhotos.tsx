import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { localDate, type WeightEntry } from "@/lib/fitness/model";
import { photoTimeline, type ProgressPhoto, type PhotoRepository } from "@/lib/fitness/photos";
import type { ProgressPhotosState } from "@/hooks/use-progress-photos";
import { card, input, primary, secondary, Confirm, Empty } from "./shared";

const categories = {
  "": "未分類",
  front: "Front 正面",
  side: "Side 側面",
  back: "Back 背面",
  other: "Other 其他",
};
export function PhotoImage({
  photo,
  repository: photoRepository,
  large = false,
}: {
  photo: ProgressPhoto;
  repository: PhotoRepository;
  large?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setUrl("");
    setFailed(false);
    void photoRepository
      .image(photo)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo, photoRepository]);
  return url ? (
    <img
      src={url}
      alt={`${photo.date} ${categories[photo.category]}體態照片`}
      className={
        large
          ? "max-h-[70dvh] w-full object-contain"
          : "aspect-[3/4] w-full rounded-xl bg-ink/5 object-contain"
      }
      loading="lazy"
    />
  ) : (
    <span className="grid aspect-[3/4] place-items-center rounded-xl bg-ink/5 p-2 text-xs text-muted">
      {failed ? "照片讀取失敗，請重試" : "載入照片…"}
    </span>
  );
}
export function LatestPhoto({ state, onOpen }: { state: ProgressPhotosState; onOpen: () => void }) {
  const latest = state.photos[0];
  if (!latest)
    return (
      <button className={`${secondary} w-full`} onClick={onOpen}>
        ＋ 新增體態照片（不需量體重）
      </button>
    );
  return (
    <button className={`${card} flex w-full items-center gap-4 text-left`} onClick={onOpen}>
      <span className="w-20 shrink-0">
        <PhotoImage photo={latest} repository={state.repository} />
      </span>
      <span>
        <span className="block text-sm font-bold">最新體態照片</span>
        <span className="mt-1 block text-xs text-muted">
          {latest.date} · {categories[latest.category]}
        </span>
        <span className="mt-2 block text-sm">查看照片與時間軸 →</span>
      </span>
    </button>
  );
}
export function ProgressPhotos({
  state,
  weights,
}: {
  state: ProgressPhotosState;
  weights: WeightEntry[];
}) {
  const [date, setDate] = useState(localDate);
  const [category, setCategory] = useState<ProgressPhoto["category"]>("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState("");
  const [photoA, setA] = useState("");
  const [photoB, setB] = useState("");
  const timeline = photoTimeline(state.photos, weights);
  const a = state.photos.find((p) => p.id === photoA);
  const b = state.photos.find((p) => p.id === photoB);
  return (
    <section className="space-y-4" aria-label="體態照片與時間軸">
      <form
        className={`${card} space-y-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file || state.busy) return;
          if (await state.add({ date, category, note }, file)) {
            setFile(null);
            setFileKey((k) => k + 1);
            setNote("");
            setMessage("照片已保存，沒有建立或修改體重紀錄。");
          }
        }}
      >
        <h2 className="font-disp text-xl font-bold">體態照片</h2>
        <p className="text-sm text-muted">照片與體重各自記錄，不用填體重。同一天可新增多張。</p>
        <p className="rounded-xl bg-ink/5 p-3 text-xs leading-relaxed">
          {state.cloud
            ? "使用已登入帳號的私人 Supabase 儲存。照片只用於紀錄與比較。"
            : "照片只保存在此瀏覽器（IndexedDB），不會上傳、不跨裝置同步；清除網站資料會刪除照片。"}
        </p>
        <label className="block text-sm">
          選擇照片
          <input
            key={fileKey}
            className={`${input} mt-1 py-3 text-sm`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setMessage("");
            }}
          />
        </label>
        <p className="text-xs text-muted">JPEG、PNG、WebP，最多 10 MB；保存時縮至最長邊 2048px。</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            照片日期
            <input
              className={`${input} mt-1`}
              type="date"
              max={localDate()}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            照片分類（選填）
            <select
              className={`${input} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value as ProgressPhoto["category"])}
            >
              {Object.entries(categories).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          照片備註（選填）
          <input
            className={`${input} mt-1`}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className={`${primary} w-full`}
          disabled={!file || !state.ready || state.busy}
        >
          {state.busy ? "處理中…" : "保存照片"}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
      {state.error && (
        <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-destructive">
          <p>{state.error}</p>
          <button
            className={`${secondary} mt-2`}
            disabled={state.busy}
            onClick={() => void state.reload()}
          >
            重試照片載入
          </button>
        </div>
      )}
      <section className={`${card} space-y-3`}>
        <h3 className="font-bold">照片與體重時間軸</h3>
        {!timeline.length && <Empty>尚無紀錄。可先量體重，也可以只新增一張照片。</Empty>}
        {timeline.map((day) => (
          <article key={day.date} className="space-y-3 border-t border-ink/10 pt-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h4 className="font-mono text-sm">{day.date}</h4>
              <p className="text-sm">
                {day.weight ? `體重 ${day.weight.weight} kg` : "當天未記錄體重"} ·{" "}
                {day.photos.length} 張照片
              </p>
            </div>
            {!day.photos.length && <p className="text-sm text-muted">當天沒有體態照片。</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {day.photos.map((photo) => (
                <div key={photo.id} className="min-w-0 space-y-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-halo"
                        aria-label={`查看 ${photo.date} ${categories[photo.category]}照片`}
                      >
                        <PhotoImage photo={photo} repository={state.repository} />
                        <span className="mt-1 block text-xs">{categories[photo.category]}</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto bg-paper sm:max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>
                          {photo.date} · {categories[photo.category]}
                        </DialogTitle>
                        <DialogDescription>{photo.note || "體態照片完整預覽"}</DialogDescription>
                      </DialogHeader>
                      <PhotoImage photo={photo} repository={state.repository} large />
                    </DialogContent>
                  </Dialog>
                  {photo.note && <p className="break-words text-xs text-muted">{photo.note}</p>}
                  <Confirm
                    title="刪除這張照片？"
                    description="只刪除此張照片，不影響當天體重與其他照片。此操作無法復原。"
                    destructive
                    onConfirm={() => void state.remove(photo)}
                  >
                    <button
                      className={`${secondary} w-full text-destructive`}
                      disabled={state.busy}
                      aria-label={`刪除 ${photo.date} ${categories[photo.category]}照片`}
                    >
                      刪除照片
                    </button>
                  </Confirm>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
      {state.photos.length >= 2 && (
        <section className={`${card} space-y-3`}>
          <h3 className="font-bold">兩張照片比較</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "照片 A", value: photoA, change: setA, other: photoB },
              { label: "照片 B", value: photoB, change: setB, other: photoA },
            ].map((side) => (
              <label key={side.label} className="text-sm">
                {side.label}
                <select
                  className={`${input} mt-1 text-sm`}
                  value={side.value}
                  onChange={(e) => side.change(e.target.value)}
                >
                  <option value="">選擇照片</option>
                  {state.photos.map((p, i) => (
                    <option key={p.id} value={p.id} disabled={p.id === side.other}>
                      {p.date} · {categories[p.category]} · {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {a && b && (
            <div className="grid grid-cols-2 gap-3">
              {[a, b].map((photo) => (
                <figure key={photo.id}>
                  <figcaption className="mb-2 text-xs">
                    {photo.date} · {categories[photo.category]}
                  </figcaption>
                  <PhotoImage photo={photo} repository={state.repository} />
                </figure>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">僅供目視比較，不分析身材、體脂或肌肉量。</p>
        </section>
      )}
    </section>
  );
}

