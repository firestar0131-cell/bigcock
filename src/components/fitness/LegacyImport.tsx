import { useState } from "react";
import { FITNESS_STORAGE_KEY, loadFitness } from "@/lib/fitness/storage";
import { mergeLegacy } from "@/lib/fitness/legacy";
import type { FitnessUpdate } from "@/lib/fitness/sync";
import { localPhotoRepository, uploadLegacyPhoto } from "@/lib/fitness/photo-storage";
import { card, secondary } from "./shared";
const OWNER = "burnlog.fitness.import-owner";
export function LegacyImport({
  userId,
  update,
  reloadPhotos,
  disabled,
}: {
  userId: string;
  update: FitnessUpdate;
  reloadPhotos: () => Promise<void>;
  disabled: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <details className={`${card} my-4 text-sm`}>
      <summary className="min-h-11 cursor-pointer py-3">匯入此瀏覽器的舊 Fitness 紀錄</summary>
      <p>
        只有舊版存在此網域、此瀏覽器的資料可匯入。雲端已有的同日體重與同 ID
        紀錄優先；尚未修改的預設模板可套用舊版設定。舊本機資料會保留。
      </p>
      <label className="my-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        我確認這些舊紀錄與照片屬於目前登入帳號
      </label>
      <button
        className={secondary}
        disabled={disabled || busy || !confirmed}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            const owner = localStorage.getItem(OWNER);
            if (owner && owner !== userId)
              throw new Error("這份本機資料已指定給另一個帳號，請改登入原帳號。");
            // Bind before any upload: interrupted imports cannot be claimed by a different account.
            localStorage.setItem(OWNER, userId);
            if (localStorage.getItem(FITNESS_STORAGE_KEY)) {
              const old = loadFitness(localStorage);
              if (!(await update((current) => mergeLegacy(current, old))))
                throw new Error("舊紀錄匯入未完成，請重新載入雲端資料後重試。");
            }
            const photos = await localPhotoRepository.list();
            for (const photo of photos)
              await uploadLegacyPhoto(userId, photo, await localPhotoRepository.image(photo));
            await reloadPhotos();
            setMessage("匯入完成；原始本機資料仍保留。重複匯入不會新增相同 ID 的照片。");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "匯入失敗，原始資料仍保留。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在匯入，請勿關閉…" : "匯入至目前帳號"}
      </button>
      {message && (
        <p role="status" className="mt-2">
          {message}
        </p>
      )}
    </details>
  );
}

