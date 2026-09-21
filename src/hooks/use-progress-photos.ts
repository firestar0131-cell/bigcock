import { useCallback, useEffect, useRef, useState } from "react";
import { photoRepository, useCloudPhotos } from "@/lib/fitness/photo-storage";
import { preparePhoto, type PhotoInput, type ProgressPhoto } from "@/lib/fitness/photos";

export function useProgressPhotos() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const reload = useCallback(async () => {
    const id = ++generation.current;
    try {
      const list = await photoRepository.list();
      if (id !== generation.current) return;
      setPhotos(list);
      setReady(true);
      setError("");
    } catch (e) {
      if (id !== generation.current) return;
      setError(e instanceof Error ? e.message : "照片讀取失敗。");
      setReady(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    let unsubscribe: (() => void) | undefined;
    let active = true;
    if (useCloudPhotos)
      void import("@/integrations/supabase/client").then(({ supabase }) => {
        if (!active) return;
        const { data } = supabase.auth.onAuthStateChange(() => {
          invalidate();
          setPhotos([]);
          setReady(false);
          window.setTimeout(() => {
            if (active) void reload();
          }, 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      });
    return () => {
      active = false;
      invalidate();
      unsubscribe?.();
    };
  }, [reload, invalidate]);
  async function add(input: PhotoInput, file: File) {
    setBusy(true);
    setError("");
    try {
      const blob = await preparePhoto(file);
      await photoRepository.add(input, blob);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "照片未保存。");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function remove(photo: ProgressPhoto) {
    setBusy(true);
    setError("");
    try {
      await photoRepository.remove(photo);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "照片未刪除。");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { photos, error, ready, busy, add, remove, reload, cloud: useCloudPhotos };
}
export type ProgressPhotosState = ReturnType<typeof useProgressPhotos>;
