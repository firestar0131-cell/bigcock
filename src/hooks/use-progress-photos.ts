import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloudPhotoRepository } from "@/lib/fitness/photo-storage";
import { preparePhoto, type PhotoInput, type ProgressPhoto } from "@/lib/fitness/photos";

export function useProgressPhotos(userId: string) {
  const photoRepository = useMemo(() => cloudPhotoRepository(userId), [userId]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const operation = useRef(false);
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
  }, [photoRepository]);
  useEffect(() => {
    void reload();
    return () => {
      invalidate();
    };
  }, [reload, invalidate]);
  async function add(input: PhotoInput, file: File) {
    if (operation.current) return false;
    operation.current = true;
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
      operation.current = false;
      setBusy(false);
    }
  }
  async function remove(photo: ProgressPhoto) {
    if (operation.current) return false;
    operation.current = true;
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
      operation.current = false;
      setBusy(false);
    }
  }
  return {
    photos,
    error,
    ready,
    busy,
    add,
    remove,
    reload,
    cloud: true,
    repository: photoRepository,
  };
}
export type ProgressPhotosState = ReturnType<typeof useProgressPhotos>;

