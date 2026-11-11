export const SITE_ACCESS_PASSWORD = import.meta.env?.["VITE_SITE_ACCESS_PASSWORD"] || "firestar144";
export const SITE_ACCESS_STORAGE_KEY = "burnlog.site.unlocked";
export const SITE_LAST_ACTIVITY_KEY = "burnlog.site.lastActivity";
export const SITE_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function siteAccessIsCurrent(storage: Pick<Storage, "getItem">, now = Date.now()): boolean {
  if (storage.getItem(SITE_ACCESS_STORAGE_KEY) !== "1") return false;
  const lastActivity = Number(storage.getItem(SITE_LAST_ACTIVITY_KEY));
  return lastActivity > 0 && lastActivity <= now && now - lastActivity < SITE_IDLE_TIMEOUT_MS;
}
