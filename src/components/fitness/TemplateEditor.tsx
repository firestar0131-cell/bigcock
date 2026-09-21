import { useState } from "react";
import type { WorkoutTemplate } from "@/lib/fitness/model";
import { card, input, primary, secondary } from "./shared";

export function TemplateEditor({
  template,
  onSave,
  onCancel,
}: {
  template: WorkoutTemplate;
  onSave: (template: WorkoutTemplate) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(template));
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !draft.name.trim() ||
          !draft.exercises.length ||
          draft.exercises.some(
            (e) =>
              !e.name.trim() ||
              !Number.isInteger(e.sets) ||
              e.sets < 1 ||
              e.sets > 30 ||
              !Number.isInteger(e.minReps) ||
              !Number.isInteger(e.maxReps) ||
              e.minReps < 1 ||
              e.maxReps > 1000 ||
              e.maxReps < e.minReps,
          )
        ) {
          setError("請填寫模板與動作名稱，組數 1–30，次數 1–1000，且上限不可小於下限。");
          return;
        }
        onSave({
          ...draft,
          name: draft.name.trim(),
          exercises: draft.exercises.map((e) => ({ ...e, name: e.name.trim() })),
        });
      }}
    >
      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">編輯訓練模板</h2>
        <p className="text-xs text-muted">
          修改只套用到下次新訓練；動作重新命名仍保留同一份歷史。不同動作請新增。
        </p>
        <label className="block text-sm">
          模板名稱
          <input
            className={`${input} mt-1`}
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
      </section>
      {draft.exercises.map((exercise, index) => (
        <section key={exercise.id} className={`${card} space-y-3`}>
          <label className="block text-sm">
            動作 {index + 1}
            <input
              className={`${input} mt-1`}
              required
              maxLength={100}
              value={exercise.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  exercises: draft.exercises.map((x, i) =>
                    i === index ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["sets", "組數"],
                ["minReps", "最低次數"],
                ["maxReps", "最高次數"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs">
                {label}
                <input
                  className={`${input} mt-1`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={key === "sets" ? 30 : 1000}
                  step="1"
                  required
                  value={exercise[key] || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      exercises: draft.exercises.map((x, i) =>
                        i === index ? { ...x, [key]: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className={`${secondary} text-destructive`}
            disabled={draft.exercises.length === 1}
            onClick={() =>
              setDraft({ ...draft, exercises: draft.exercises.filter((_, i) => i !== index) })
            }
          >
            移除此動作
          </button>
        </section>
      ))}
      <button
        type="button"
        className={secondary}
        onClick={() =>
          setDraft({
            ...draft,
            exercises: [
              ...draft.exercises,
              { id: crypto.randomUUID(), name: "", sets: 3, minReps: 8, maxReps: 12 },
            ],
          })
        }
      >
        ＋ 新增動作
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={`${primary} flex-1`}>
          儲存模板
        </button>
        <button type="button" className={secondary} onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
