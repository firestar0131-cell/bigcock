import { useEffect, useState } from "react";
import {
  SITE_ACCESS_PASSWORD,
  SITE_ACCESS_STORAGE_KEY,
  SITE_IDLE_TIMEOUT_MS,
  SITE_LAST_ACTIVITY_KEY,
  siteAccessIsCurrent,
} from "@/lib/site-access";

export function SiteGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && siteAccessIsCurrent(localStorage),
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!unlocked) return;
    const lock = () => {
      localStorage.removeItem(SITE_ACCESS_STORAGE_KEY);
      localStorage.removeItem(SITE_LAST_ACTIVITY_KEY);
      setUnlocked(false);
      setPassword("");
    };
    const check = () => {
      if (!siteAccessIsCurrent(localStorage)) lock();
    };
    const activity = () => {
      if (!siteAccessIsCurrent(localStorage)) {
        lock();
        return;
      }
      localStorage.setItem(SITE_LAST_ACTIVITY_KEY, String(Date.now()));
    };
    const onVisibility = () => {
      if (!document.hidden) check();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SITE_ACCESS_STORAGE_KEY || event.key === SITE_LAST_ACTIVITY_KEY) check();
    };
    check();
    const timer = window.setInterval(check, Math.min(SITE_IDLE_TIMEOUT_MS, 5000));
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("scroll", activity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("scroll", activity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [unlocked]);

  if (unlocked) {
    return (
      <>
        {children}
        <button
          className="fixed right-3 top-3 z-30 rounded-full bg-ink px-3 py-2 text-xs font-bold text-paper shadow"
          onClick={() => {
            localStorage.removeItem(SITE_ACCESS_STORAGE_KEY);
            localStorage.removeItem(SITE_LAST_ACTIVITY_KEY);
            setUnlocked(false);
            setPassword("");
          }}
        >
          Lock
        </button>
      </>
    );
  }
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white/70 p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (password === SITE_ACCESS_PASSWORD) {
            localStorage.setItem(SITE_ACCESS_STORAGE_KEY, "1");
            localStorage.setItem(SITE_LAST_ACTIVITY_KEY, String(Date.now()));
            setUnlocked(true);
            setError("");
          } else {
            setError("密碼錯誤，請重試。");
          }
        }}
      >
        <h1 className="font-disp text-2xl font-black">Password</h1>
        <p className="text-sm text-muted">提示：名字＋長寬</p>
        <input
          className="w-full rounded-xl border border-ink/15 bg-paper px-4 py-3"
          type="password"
          aria-label="Password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          autoFocus
          required
        />
        <button className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-paper" type="submit">
          Enter
        </button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
