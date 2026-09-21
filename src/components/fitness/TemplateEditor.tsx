import { useState } from "react";
import {
  findLibraryExercise,
  type LibraryExercise,
  type WorkoutTemplate,
} from "@/lib/fitness/model";
import { card, input, primary, secondary } from "./shared";

export function TemplateEditor({
  template,
  library,
  onSave,
  onCancel,
}: {
  template: WorkoutTemplate;
  library: LibraryExercise[];
  onSave: (template: WorkoutTemplate, library: LibraryExercise[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(template));
  const [error, setError] = useState("");
  const [draftLibrary, setLibrary] = useState(() => structuredClone(library));
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState({
    name: "",
    minReps: 8,
    maxReps: 12,
    restSeconds: 90,
    notes: "",
  });
  function add(exercise: LibraryExercise) {
    if (draft.exercises.some((e) => e.id === exercise.id)) {
      setError("此模板已有這個動作，可直接調整組數。");
      return;
    }
    const { notes: _notes, ...defaults } = exercise;
    setDraft({ ...draft, exercises: [...draft.exercises, { ...defaults, sets: 3 }] });
    setError("");
    setSelected("");
  }
  function createCustom() {
    const name = custom.name.trim();
    if (
      !name ||
      !Number.isInteger(custom.minReps) ||
      !Number.isInteger(custom.maxReps) ||
      custom.minReps < 1 ||
      custom.maxReps > 1000 ||
      custom.maxReps < custom.minReps ||
      !Number.isInteger(custom.restSeconds) ||
      custom.restSeconds < 0 ||
      custom.restSeconds > 3600
    ) {
      setError("請填寫自訂動作名稱、有效的次數範圍與 0–3600 秒休息時間。");
      return;
    }
    const existing = findLibraryExercise(draftLibrary, name);
    if (existing) {
      add(existing);
      setCustom({ ...custom, name: "", notes: "" });
      return;
    }
    const exercise: LibraryExercise = { ...custom, name, id: crypto.randomUUID() };
    setLibrary([...draftLibrary, exercise]);
    add(exercise);
    setCustom({ ...custom, name: "", notes: "" });
  }
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
              e.maxReps < e.minReps ||
              !Number.isInteger(e.restSeconds) ||
              e.restSeconds < 0 ||
              e.restSeconds > 3600,
          )
        ) {
          setError("請填寫模板與動作名稱，組數 1–30，次數 1–1000，且上限不可小於下限。");
          return;
        }
        const names = draft.exercises.map((e) => ({ id: e.id, name: e.name.trim() }));
        if (
          names.some((e) => {
            const existing = findLibraryExercise(draftLibrary, e.name);
            const duplicate = findLibraryExercise(
              draft.exercises.filter((other) => other.id !== e.id),
              e.name,
            );
            return duplicate || (existing && existing.id !== e.id);
          })
        ) {
          setError("這個名稱已存在於共用動作庫，請從動作庫加入，避免建立重複動作。");
          return;
        }
        onSave(
          {
            ...draft,
            name: draft.name.trim(),
            exercises: draft.exercises.map((e) => ({ ...e, name: e.name.trim() })),
          },
          draftLibrary.map((e) => ({
            ...e,
            name: names.find((n) => n.id === e.id)?.name ?? e.name,
          })),
        );
      }}
    >
      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">編輯訓練模板</h2>
        <p className="text-xs text-muted">
          組數、次數與休息時間只影響此模板的新訓練，歷史紀錄不變。不同動作請從動作庫加入。
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
          <label className="block text-sm">
            預設休息（秒；0＝不計時）
            <input
              className={`${input} mt-1`}
              type="number"
              min="0"
              max="3600"
              step="1"
              inputMode="numeric"
              required
              value={exercise.restSeconds}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  exercises: draft.exercises.map((x, i) =>
                    i === index ? { ...x, restSeconds: Number(e.target.value) } : x,
                  ),
                })
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                className={secondary}
                disabled={index + direction < 0 || index + direction >= draft.exercises.length}
                aria-label={`${direction === -1 ? "上移" : "下移"} ${exercise.name}`}
                onClick={() => {
                  const exercises = [...draft.exercises];
                  [exercises[index], exercises[index + direction]] = [
                    exercises[index + direction]!,
                    exercises[index]!,
                  ];
                  setDraft({ ...draft, exercises });
                }}
              >
                {direction === -1 ? "↑ 上移" : "↓ 下移"}
              </button>
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
      <section className={`${card} space-y-3`}>
        <h3 className="font-bold">共用動作庫</h3>
        <label className="block text-sm">
          選擇動作
          <select
            className={`${input} mt-1`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">選擇要加入的動作</option>
            {draftLibrary
              .filter((e) => !draft.exercises.some((x) => x.id === e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className={secondary}
          disabled={!selected}
          onClick={() => {
            const e = draftLibrary.find((x) => x.id === selected);
            if (e) add(e);
          }}
        >
          加入選取動作
        </button>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">建立自訂動作</summary>
          <div className="space-y-3">
            <label className="block text-sm">
              新動作名稱
              <input
                className={input}
                value={custom.name}
                maxLength={100}
                onChange={(e) => setCustom({ ...custom, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["minReps", "預設最低次數"],
                  ["maxReps", "預設最高次數"],
                  ["restSeconds", "預設休息秒數"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs">
                  {label}
                  <input
                    className={input}
                    type="number"
                    inputMode="numeric"
                    min={key === "restSeconds" ? 0 : 1}
                    max={key === "restSeconds" ? 3600 : 1000}
                    value={custom[key]}
                    onChange={(e) => setCustom({ ...custom, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm">
              動作備註（選填）
              <input
                className={input}
                value={custom.notes}
                maxLength={500}
                onChange={(e) => setCustom({ ...custom, notes: e.target.value })}
              />
            </label>
            <button type="button" className={secondary} onClick={createCustom}>
              建立並加入動作
            </button>
            <p className="text-xs text-muted">
              名稱大小寫、空白與標點差異會使用既有動作；儲存模板時一起保存。
            </p>
          </div>
        </details>
      </section>
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
