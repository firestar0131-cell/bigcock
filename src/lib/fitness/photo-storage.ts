import {
  newPhoto,
  photoSchema,
  type PhotoInput,
  type PhotoRepository,
  type ProgressPhoto,
} from "./photos";

export const PHOTO_DB = "burnlog.progress-photos";
type StoredPhoto = ProgressPhoto & { blob: Blob };
async function localTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id" });
    request.onerror = () => reject(new Error("無法開啟本機照片儲存，請確認瀏覽器儲存權限。"));
    request.onblocked = () => reject(new Error("照片資料庫被其他分頁占用，請關閉其他分頁後重試。"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const transaction = db.transaction("photos", mode);
      const operation = action(transaction.objectStore("photos"));
      transaction.oncomplete = () => {
        const result = operation.result;
        db.close();
        resolve(result);
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error ?? new Error("照片未儲存，請檢查儲存空間後重試。"));
      };
      transaction.onerror = () => {
        /* onabort reports the failure without committing partial data. */
      };
    };
  });
}
export const localPhotoRepository: PhotoRepository = {
  async list() {
    const rows = await localTransaction<StoredPhoto[]>("readonly", (s) => s.getAll());
    return rows
      .map((photo) => photoSchema.parse(photo))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  },
  async image(photo) {
    const row = await localTransaction<StoredPhoto | undefined>("readonly", (s) => s.get(photo.id));
    if (!row?.blob) throw new Error("找不到照片，請重新整理。");
    return row.blob;
  },
  async add(input, blob) {
    const photo = newPhoto(input);
    await localTransaction("readwrite", (s) => s.add({ ...photo, blob }));
    return photo;
  },
  async remove(photo) {
    await localTransaction("readwrite", (s) => s.delete(photo.id));
  },
};

const BUCKET = "fitness-progress-photos";
async function cloudUser(expectedUser: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== expectedUser)
    throw new Error("私人雲端照片需要登入 Supabase 帳號，請先完成登入設定。");
  return { supabase, userId: data.user.id };
}
function checkOwner(photo: ProgressPhoto, userId: string) {
  if (photo.imageRef !== `${userId}/${photo.id}.jpg`) throw new Error("照片不屬於目前登入的帳號。");
}
export function cloudPhotoRepository(expectedUser: string): PhotoRepository {
  return {
    async list() {
      const { supabase, userId } = await cloudUser(expectedUser);
      const { data, error } = await supabase
        .from("fitness_progress_photos")
        .select("id,date,image_ref,category,note,created_at")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error("無法讀取私人照片，請確認 Supabase migration 與權限已設定。");
      return data.map((row) => {
        const photo = photoSchema.parse({
          id: row.id,
          date: row.date,
          imageRef: row.image_ref,
          category: row.category,
          note: row.note,
          createdAt: new Date(row.created_at).getTime(),
        });
        checkOwner(photo, userId);
        return photo;
      });
    },
    async image(photo) {
      const { supabase, userId } = await cloudUser(expectedUser);
      checkOwner(photo, userId);
      const { data, error } = await supabase.storage.from(BUCKET).download(photo.imageRef);
      if (error) throw new Error("照片載入失敗，請確認登入狀態後重試。");
      return data;
    },
    async add(input: PhotoInput, blob: Blob) {
      const { supabase, userId } = await cloudUser(expectedUser);
      const base = newPhoto(input);
      const photo = { ...base, imageRef: `${userId}/${base.id}.jpg` };
      return storeCloudPhoto(expectedUser, photo, blob);
    },
    async remove(photo) {
      const { supabase, userId } = await cloudUser(expectedUser);
      checkOwner(photo, userId);
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.imageRef]);
      if (storageError) throw new Error("照片刪除失敗，請稍後重試。");
      const { error } = await supabase
        .from("fitness_progress_photos")
        .delete()
        .eq("id", photo.id)
        .eq("user_id", userId);
      if (error) throw new Error("影像已移除，但紀錄尚待清理，請再按一次刪除。");
    },
  };
}

async function storeCloudPhoto(
  expectedUser: string,
  photo: ProgressPhoto,
  blob: Blob,
): Promise<ProgressPhoto> {
  const { supabase, userId } = await cloudUser(expectedUser);
  checkOwner(photo, userId);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(photo.imageRef, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw new Error("私人照片上傳失敗，請確認登入、私人 bucket 與 storage policy。");
  const { error } = await supabase.from("fitness_progress_photos").insert({
    id: photo.id,
    user_id: userId,
    date: photo.date,
    image_ref: photo.imageRef,
    category: photo.category,
    note: photo.note,
    created_at: new Date(photo.createdAt).toISOString(),
  });
  if (error) {
    const cleanup = await supabase.storage.from(BUCKET).remove([photo.imageRef]);
    throw new Error(
      cleanup.error
        ? "照片資料未完成保存；私人儲存中有待清理檔案，請稍後聯絡管理者。"
        : "照片資料未保存，上傳已撤回，請確認資料表權限。",
    );
  }
  return photo;
}
export async function uploadLegacyPhoto(userId: string, legacy: ProgressPhoto, blob: Blob) {
  const { supabase } = await cloudUser(userId);
  const { data, error } = await supabase
    .from("fitness_progress_photos")
    .select("id")
    .eq("user_id", userId)
    .eq("id", legacy.id)
    .maybeSingle();
  if (error) throw new Error("無法檢查舊照片是否已匯入。");
  if (data) return;
  await storeCloudPhoto(userId, { ...legacy, imageRef: `${userId}/${legacy.id}.jpg` }, blob);
}

