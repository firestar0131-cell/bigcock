import { useState } from "react";
import {
  blankSet,
  copyPrevious,
  localDate,
  previousExercise,
  validDate,
  validSet,
  volume,
  type ExerciseSession,
  type WorkoutSession,
} from "@/lib/fitness/model";
import { card, input, primary, secondary, Confirm, Empty } from "./shared";

export function SessionEditor({
  session,
  history,
  onChange,
  onFinish,
  onDiscard,
  historical = false,
}: {
  session: WorkoutSession;
  history: WorkoutSession[];
  onChange: (session: WorkoutSession) => void;
  onFinish: () => void;
  onDiscard: () => void;
  historical?: boolean;
}) {
  const [error, setError] = useState("");
  const completed = session.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completed && validSet(s)).length,
    0,
  );
  const total = session.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  function changeExercise(index: number, next: ExerciseSession) {
    onChange({ ...session, exercises: session.exercises.map((e, i) => (i === index ? next : e)) });
    setError("");
  }
  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <div>
          <p className="text-xs text-muted">
            {historical ? "編輯歷史訓練" : "訓練進行中 · 即時儲存"}
          </p>
          <h2 className="mt-1 font-disp text-2xl font-black">{session.name}</h2>
        </div>
        <label className="block text-sm">
          訓練日期
          <input
            className={`${input} mt-1`}
            type="date"
            max={localDate()}
            value={session.date}
            onChange={(e) => {
              if (validDate(e.target.value) && e.target.value <= localDate())
                onChange({ ...session, date: e.target.value });
            }}
          />
        </label>
        <p className="text-sm text-muted">
          已完成 {completed} / {total} 組 ·{" "}
          {session.exercises.reduce((sum, e) => sum + volume(e), 0).toLocaleString()} kg 總訓練量
        </p>
        <p className="text-xs text-muted">
          徒手動作可填 0 kg；訓練量只計已完成組的外加重量 × 次數。
        </p>
      </section>
      {session.exercises.map((exercise, index) => {
        const last = previousExercise(history, session, exercise.exerciseId);
        const allDone =
          exercise.sets.length > 0 && exercise.sets.every((s) => s.completed && validSet(s));
        return (
          <section
            className={`${card} space-y-3`}
            key={exercise.exerciseId}
            aria-label={exercise.name}
          >
            <div>
              <h3 className="font-disp text-lg font-bold">
                {exercise.name}
                {allDone ? " ✓" : ""}
              </h3>
              <p className="text-xs text-muted">
                目標 {exercise.plannedSets} 組 × {exercise.minReps}–{exercise.maxReps} 次
              </p>
            </div>
            {last ? (
              <div className="rounded-xl bg-halo/15 p-3">
                <p className="text-xs font-bold">上一次 · {last.session.date}</p>
                <p className="mt-1 text-sm tabular-nums">
                  {last.exercise.sets
                    .filter((s) => s.completed && validSet(s))
                    .map((s) => `${s.weight} kg × ${s.reps}`)
                    .join(" ／ ")}
                </p>
                <button
                  className={`${secondary} mt-2`}
                  onClick={() => changeExercise(index, copyPrevious(exercise, last.exercise))}
                >
                  帶入上次紀錄至空白組
                </button>
              </div>
            ) : (
              <Empty>這個動作還沒有先前紀錄。</Empty>
            )}
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 text-xs text-muted">
              <span>組</span>
              <span>重量 kg</span>
              <span>次數</span>
              <span>完成</span>
            </div>
            {exercise.sets.map((set, i) => (
              <div key={set.id}>
                <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2">
                  <span className="text-sm tabular-nums">{i + 1}</span>
                  <input
                    aria-label={`${exercise.name} 第 ${i + 1} 組重量`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    max="2000"
                    placeholder="kg"
                    value={set.weight ?? ""}
                    className={input}
                    onChange={(e) =>
                      changeExercise(index, {
                        ...exercise,
                        sets: exercise.sets.map((s) =>
                          s.id === set.id
                            ? {
                                ...s,
                                weight: e.target.value === "" ? null : Number(e.target.value),
                                completed: false,
                              }
                            : s,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`${exercise.name} 第 ${i + 1} 組次數`}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    max="1000"
                    placeholder={`${exercise.minReps}–${exercise.maxReps}`}
                    value={set.reps ?? ""}
                    className={input}
                    onChange={(e) =>
                      changeExercise(index, {
                        ...exercise,
                        sets: exercise.sets.map((s) =>
                          s.id === set.id
                            ? {
                                ...s,
                                reps: e.target.value === "" ? null : Number(e.target.value),
                                completed: false,
                              }
                            : s,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`${exercise.name} 第 ${i + 1} 組完成`}
                    aria-pressed={set.completed}
                    className={`h-12 w-12 rounded-xl border text-lg ${set.completed ? "border-ink bg-ink text-paper" : "border-ink/15 bg-ink/5"}`}
                    onClick={() => {
                      if (!set.completed && !validSet(set)) {
                        setError("請先填入這組有效的重量與整數次數，再勾選完成。");
                        return;
                      }
                      changeExercise(index, {
                        ...exercise,
                        sets: exercise.sets.map((s) =>
                          s.id === set.id ? { ...s, completed: !s.completed } : s,
                        ),
                      });
                    }}
                  >
                    {set.completed ? "✓" : "○"}
                  </button>
                </div>
                {i >= exercise.plannedSets && (
                  <Confirm
                    title="刪除額外組？"
                    description="這組已輸入的重量與次數也會刪除。"
                    destructive
                    onConfirm={() =>
                      changeExercise(index, {
                        ...exercise,
                        sets: exercise.sets.filter((s) => s.id !== set.id),
                      })
                    }
                  >
                    <button
                      className="min-h-11 px-2 text-xs text-destructive"
                      aria-label={`刪除 ${exercise.name} 第 ${i + 1} 組`}
                    >
                      刪除額外組
                    </button>
                  </Confirm>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                className={secondary}
                onClick={() =>
                  changeExercise(index, { ...exercise, sets: [...exercise.sets, blankSet()] })
                }
              >
                ＋ 新增一組
              </button>
              <button
                className={secondary}
                disabled={allDone}
                onClick={() => {
                  if (!exercise.sets.every(validSet)) {
                    setError(`請先填好 ${exercise.name} 每組的重量與次數。`);
                    return;
                  }
                  changeExercise(index, {
                    ...exercise,
                    sets: exercise.sets.map((s) => ({ ...s, completed: true })),
                  });
                }}
              >
                完成此動作
              </button>
            </div>
          </section>
        );
      })}
      {error && (
        <p
          role="alert"
          className="sticky bottom-24 rounded-xl bg-paper p-3 text-sm text-destructive shadow-lg"
        >
          {error}
        </p>
      )}
      <div className={`${card} space-y-3`}>
        <p className="text-sm text-muted">
          完成後保留所有輸入，只有勾選完成的組會納入訓練量與上次表現。
        </p>
        <Confirm
          title={historical ? "儲存歷史修改？" : "結束本次訓練？"}
          description={`已完成 ${completed} / ${total} 組。${total > completed ? "未完成組保留為未完成，不計入進步統計。" : "所有組已完成。"}`}
          onConfirm={onFinish}
        >
          <button className={`${primary} w-full`} disabled={!completed}>
            {historical ? "儲存修改" : "完成訓練"}
          </button>
        </Confirm>
        <Confirm
          title={historical ? "放棄修改？" : "放棄本次訓練？"}
          description={
            historical ? "歷史紀錄將維持修改前的內容。" : "這次尚未完成的訓練資料會刪除。"
          }
          destructive
          onConfirm={onDiscard}
        >
          <button className={`${secondary} w-full text-destructive`}>
            {historical ? "取消修改" : "放棄訓練"}
          </button>
        </Confirm>
      </div>
    </div>
  );
}
