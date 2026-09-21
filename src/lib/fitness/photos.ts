import { z } from "zod";
import { localDate, validDate, type WeightEntry } from "./model.ts";

export const photoSchema = z.object({
  id: z.string().uuid(),
  date: z.string().refine(validDate),
  imageRef: z.string().min(1),
  category: z.enum(["", "front", "side", "back", "other"]),
  note: z.string().max(1000),
  createdAt: z.number().finite().positive(),
});
export type ProgressPhoto = z.infer<typeof photoSchema>;
export type PhotoInput = Pick<ProgressPhoto, "date" | "category" | "note">;
export interface PhotoRepository {
  list(): Promise<ProgressPhoto[]>;
  image(photo: ProgressPhoto): Promise<Blob>;
  add(input: PhotoInput, image: Blob): Promise<ProgressPhoto>;
  remove(photo: ProgressPhoto): Promise<void>;
}
export function newPhoto(input: PhotoInput): ProgressPhoto {
  if (input.date > localDate()) throw new Error("照片日期不可晚於今天。");
  const id = crypto.randomUUID();
  return photoSchema.parse({
    ...input,
    note: input.note.trim(),
    id,
    imageRef: id,
    createdAt: Date.now(),
  });
}
export function photoTimeline(photos: ProgressPhoto[], weights: WeightEntry[]) {
  return [...new Set([...photos.map((p) => p.date), ...weights.map((w) => w.date)])]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      photos: photos.filter((p) => p.date === date).sort((a, b) => b.createdAt - a.createdAt),
      weight: weights.find((w) => w.date === date) ?? null,
    }));
}
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export function validatePhotoFile(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("請選擇 JPEG、PNG 或 WebP 照片。");
  if (!file.size || file.size > MAX_PHOTO_BYTES)
    throw new Error("照片需小於 10 MB 且不可為空檔案。");
}
export async function preparePhoto(file: File): Promise<Blob> {
  validatePhotoFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("無法讀取這張照片，請改用 JPEG 或 PNG。");
  }
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器無法處理照片。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Re-encode to remove EXIF/location metadata; never persist data URLs in localStorage.
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("照片處理失敗。"))),
        "image/jpeg",
        0.88,
      ),
    );
  } finally {
    bitmap.close();
  }
}
