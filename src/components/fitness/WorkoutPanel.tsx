import { useState } from "react";
import {
  localDate,
  startWorkout,
  validDate,
  volume,
  type FitnessData,
  type WorkoutSession,
} from "@/lib/fitness/model";
import { SessionEditor } from "./SessionEditor";
import { TemplateEditor } from "./TemplateEditor";
import { BackButton, card, input, primary, secondary, Confirm, Empty } from "./shared";

export function WorkoutPanel({
  data,
  update,
}: {
  data: FitnessData;
  update: (change: (data: FitnessData) => FitnessData) => boolean;
}) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const [restDate, setRestDate] = useState(localDate);
  const [message, setMessage] = useState("");
  const template = data.templates.find((t) => t.id === templateId);
  if (data.draft)
    return (
      <SessionEditor
        session={data.draft}
        history={data.sessions}
        onChange={(draft) => update((d) => ({ ...d, draft }))}
        onFinish={() => {
          update((d) =>
            d.draft
              ? {
                  ...d,
                  sessions: [...d.sessions, { ...d.draft, finishedAt: Date.now() }],
                  restDays: d.restDays.filter((day) => day !== d.draft!.date),
                  draft: null,
                }
              : d,
          );
        }}
        onDiscard={() => update((d) => ({ ...d, draft: null }))}
      />
    );
  if (editing)
    return (
      <SessionEditor
        session={editing}
        history={data.sessions}
        historical
        onChange={setEditing}
        onFinish={() => {
          if (
            update((d) => ({
              ...d,
              sessions: d.sessions.map((s) => (s.id === editing.id ? editing : s)),
              restDays: d.restDays.filter((day) => day !== editing.date),
            }))
          )
            setEditing(null);
        }}
        onDiscard={() => setEditing(null)}
      />
    );
  if (template)
    return (
      <>
        <BackButton onClick={() => setTemplateId(null)} />
        <TemplateEditor
          template={template}
          onCancel={() => setTemplateId(null)}
          onSave={(next) => {
            if (
              update((d) => ({
                ...d,
                templates: d.templates.map((t) => (t.id === next.id ? next : t)),
              }))
            )
              setTemplateId(null);
          }}
        />
      </>
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-disp text-xl font-bold">今天練什麼？</h2>
        <p className="mt-1 text-sm text-muted">每週 3–4 次，依自己的節奏安排訓練與休息。</p>
      </div>
      {data.templates.map((t) => (
        <section key={t.id} className={`${card} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-disp text-xl font-black">{t.name}</h3>
            <button
              className={secondary}
              aria-label={`編輯 ${t.name} 模板`}
              onClick={() => setTemplateId(t.id)}
            >
              編輯模板
            </button>
          </div>
          <p className="text-xs text-muted">
            {t.exercises.length} 個動作 · {t.exercises.reduce((sum, e) => sum + e.sets, 0)} 組
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm">查看動作與組數</summary>
            <ul className="space-y-2 text-sm">
              {t.exercises.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{e.name}</span>
                  <span className="shrink-0 text-muted">
                    {e.sets} × {e.minReps}–{e.maxReps}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <button
            className={`${primary} w-full`}
            onClick={() => update((d) => ({ ...d, draft: startWorkout(t) }))}
          >
            開始 {t.name}
          </button>
        </section>
      ))}
      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">休息日</h2>
        <p className="text-sm text-muted">沒訓練不代表漏打卡。休息日不需要輸入任何組數。</p>
        <label className="block text-sm">
          休息日期
          <input
            className={`${input} mt-1`}
            type="date"
            max={localDate()}
            value={restDate}
            onChange={(e) => setRestDate(e.target.value)}
          />
        </label>
        <button
          className={secondary}
          onClick={() => {
            if (!validDate(restDate) || restDate > localDate()) {
              setMessage("請選擇有效的休息日期。");
              return;
            }
            if (data.sessions.some((s) => s.date === restDate)) {
              setMessage("當天已有訓練紀錄，無法同時標記為休息日。");
              return;
            }
            if (update((d) => ({ ...d, restDays: [...new Set([...d.restDays, restDate])] })))
              setMessage("已標記休息日。");
          }}
        >
          標記 Rest Day
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-disp text-xl font-bold">訓練歷史</h2>
        {!data.sessions.length && !data.restDays.length && (
          <Empty>尚無訓練紀錄。完成第一堂訓練後，就能在這裡回顧。</Empty>
        )}
        {[
          ...data.sessions.map((session) => ({ date: session.date, id: session.id, session })),
          ...data.restDays.map((date) => ({ date, id: `rest-${date}`, session: null })),
        ]
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              (b.session?.startedAt ?? 0) - (a.session?.startedAt ?? 0),
          )
          .map((item) =>
            item.session ? (
              <article key={item.id} className={card}>
                <details>
                  <summary className="min-h-12 cursor-pointer">
                    <span className="text-xs text-muted">{item.date}</span>
                    <span className="ml-3 font-bold">{item.session.name}</span>
                  </summary>
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-muted">
                      {Math.max(
                        1,
                        Math.round(
                          ((item.session.finishedAt ?? item.session.startedAt) -
                            item.session.startedAt) /
                            60000,
                        ),
                      )}{" "}
                      分鐘 ·{" "}
                      {item.session.exercises
                        .reduce((sum, e) => sum + volume(e), 0)
                        .toLocaleString()}{" "}
                      kg 訓練量
                    </p>
                    {item.session.exercises.map((e) => (
                      <div key={e.exerciseId}>
                        <h3 className="text-sm font-bold">{e.name}</h3>
                        <ul className="mt-1 space-y-1 text-sm text-muted">
                          {e.sets.map((s, i) => (
                            <li key={s.id}>
                              第 {i + 1} 組：{s.weight ?? "—"} kg × {s.reps ?? "—"} 次 ·{" "}
                              {s.completed ? "完成" : "未完成"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <button
                      className={secondary}
                      onClick={() => {
                        setEditing(structuredClone(item.session!));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      編輯這次訓練
                    </button>
                  </div>
                </details>
              </article>
            ) : (
              <article key={item.id} className={`${card} flex items-center justify-between gap-2`}>
                <p>
                  <span className="text-xs text-muted">{item.date}</span>
                  <span className="ml-3 font-bold">Rest</span>
                </p>
                <Confirm
                  title="取消休息日標記？"
                  description={`取消 ${item.date} 的 Rest 標記，不會新增或刪除任何訓練。`}
                  onConfirm={() =>
                    update((d) => ({
                      ...d,
                      restDays: d.restDays.filter((day) => day !== item.date),
                    }))
                  }
                >
                  <button className={secondary}>取消標記</button>
                </Confirm>
              </article>
            ),
          )}
      </section>
    </div>
  );
}
