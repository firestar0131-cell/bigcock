import { emptyFitness, type FitnessData } from "./model.ts";
// Explicit import only. Cloud records win collisions; default templates may adopt old edits.
export function mergeLegacy(cloud: FitnessData, local: FitnessData): FitnessData {
  const defaults = emptyFitness();
  const merge = <T extends { id: string }>(current: T[], previous: T[]) => [
    ...current,
    ...previous.filter((p) => !current.some((c) => c.id === p.id)),
  ];
  return {
    ...cloud,
    weights: [
      ...cloud.weights,
      ...local.weights.filter(
        (p) => !cloud.weights.some((c) => c.id === p.id || c.date === p.date),
      ),
    ],
    sessions: merge(cloud.sessions, local.sessions),
    templates: merge(
      cloud.templates.map((t) =>
        JSON.stringify(t) === JSON.stringify(defaults.templates.find((d) => d.id === t.id))
          ? (local.templates.find((p) => p.id === t.id) ?? t)
          : t,
      ),
      local.templates,
    ),
    exerciseLibrary: merge(
      cloud.exerciseLibrary.map((e) =>
        JSON.stringify(e) === JSON.stringify(defaults.exerciseLibrary.find((d) => d.id === e.id))
          ? (local.exerciseLibrary.find((p) => p.id === e.id) ?? e)
          : e,
      ),
      local.exerciseLibrary,
    ),
    draft:
      cloud.draft ??
      (local.draft && !cloud.sessions.some((s) => s.id === local.draft!.id) ? local.draft : null),
    restDays: [...new Set([...cloud.restDays, ...local.restDays])].filter(
      (date) => ![...cloud.sessions, ...local.sessions].some((s) => s.date === date),
    ),
    coachSessions: cloud.coachSessions ?? [],
    goal: JSON.stringify(cloud.goal) === JSON.stringify(defaults.goal) ? local.goal : cloud.goal,
  };
}

