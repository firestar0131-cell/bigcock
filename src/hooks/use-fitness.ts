import { useCallback, useEffect, useRef, useState } from "react";
import { emptyFitness, type FitnessData } from "@/lib/fitness/model";
import { FITNESS_STORAGE_KEY, loadFitness, saveFitness } from "@/lib/fitness/storage";

export function useFitness() {
  const [data, setData] = useState<FitnessData>(emptyFitness);
  const current = useRef(data);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function read() {
      try {
        const loaded = loadFitness(localStorage);
        current.current = loaded;
        setData(loaded);
        setReady(true);
        setError("");
      } catch {
        setReady(false);
        setError(
          "無法讀取健身資料，已保留原始紀錄。請確認瀏覽器允許儲存，或先備份 localStorage 後再處理資料格式。",
        );
      }
    }
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === FITNESS_STORAGE_KEY || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const update = useCallback(
    (change: (previous: FitnessData) => FitnessData): boolean => {
      if (!ready) return false;
      try {
        const next = change(current.current);
        saveFitness(localStorage, next);
        current.current = next;
        setData(next);
        setError("");
        return true;
      } catch {
        setError("儲存失敗，這次變更尚未保存。請檢查輸入、瀏覽器儲存空間與權限，再試一次。");
        return false;
      }
    },
    [ready],
  );
  return { data, ready, error, update };
}
