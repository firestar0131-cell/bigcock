import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { card, input, primary, secondary } from "./shared";
export function FitnessAccount({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user ?? null);
        setReady(true);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
      setPassword("");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (user) return children(user);
  return (
    <AppShell wide>
      <section className={`${card} mt-6 space-y-4`}>
        <h1 className="text-2xl font-bold">Fitness 雲端紀錄</h1>
        <p className="text-sm text-muted">
          登入同一帳號，即可在不同裝置取得體重、訓練與私人照片。原有本機資料不會被刪除。
        </p>
        {!ready ? (
          <p>正在確認登入狀態…</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setMessage("");
              try {
                const result = register
                  ? await supabase.auth.signUp({
                      email: email.trim(),
                      password,
                      options: { emailRedirectTo: `${window.location.origin}/fitness` },
                    })
                  : await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (result.error) throw result.error;
                setMessage(
                  register && !result.data.session
                    ? "請至信箱確認註冊，再回來登入。"
                    : "登入成功。",
                );
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "登入失敗，請重試。");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm">
              Email
              <input
                className={input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              密碼
              <input
                className={input}
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 8 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className={`${primary} w-full`} disabled={busy}>
              {busy ? "處理中…" : register ? "建立帳號" : "登入"}
            </button>
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setMessage("");
              }}
            >
              {register ? "已有帳號，改為登入" : "尚無帳號，註冊"}
            </button>
          </form>
        )}
        {message && (
          <p role="status" className="break-words text-sm">
            {message}
          </p>
        )}
      </section>
    </AppShell>
  );
}

