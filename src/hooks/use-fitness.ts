import { useCallback, useEffect, useRef, useState } from "react";
import { emptyFitness } from "@/lib/fitness/model";
import { fitnessRepository } from "@/lib/fitness/cloud";
import { FitnessSync, type FitnessUpdate, type SyncState } from "@/lib/fitness/sync";
export function useFitness(userId: string) {
  const [state, setState] = useState<SyncState>(() => ({
    data: emptyFitness(),
    ready: false,
    pending: 0,
    error: "",
  }));
  const [attempt, setAttempt] = useState(0);
  const sync = useRef<FitnessSync | null>(null);
  const pending = useRef(0);
  useEffect(() => {
    let active = true;
    const repository = fitnessRepository(userId);
    setState((s) => ({ ...s, ready: false, error: "" }));
    void repository
      .load()
      .then((initial) => {
        if (!active) return;
        sync.current = new FitnessSync(repository, initial, (next) => {
          pending.current = next.pending;
          if (active) setState(next);
        });
        setState({ data: initial.data, pending: 0, error: "", ready: true });
      })
      .catch((error: unknown) => {
        if (active)
          setState((s) => ({
            ...s,
            ready: false,
            error: error instanceof Error ? error.message : "雲端讀取失敗。",
          }));
      });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      active = false;
      sync.current?.stop();
      sync.current = null;
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [userId, attempt]);
  const update: FitnessUpdate = useCallback(
    (change) => sync.current?.update(change) ?? Promise.resolve(false),
    [],
  );
  const reload = useCallback(() => {
    if (!pending.current) setAttempt((n) => n + 1);
  }, []);
  return { ...state, update, reload };
}

