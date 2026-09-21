import { z } from "zod";
import {
  defaultRest,
  emptyFitness,
  validDate,
  type FitnessData,
  type LibraryExercise,
} from "./model.ts";

export const FITNESS_STORAGE_KEY = "burnlog.fitness.v1";
export const FITNESS_V1_BACKUP_KEY = "burnlog.fitness.v1.backup";
const date = z.string().refine(validDate);
const id = z.string().min(1);
const positive = z.number().finite().positive();
const restSeconds = z.number().int().min(0).max(3600);
const restTimer = z
  .object({
    exerciseId: id,
    exerciseName: id,
    durationSeconds: restSeconds,
    endsAt: positive.nullable(),
  })
  .nullable();
const libraryExercise = z.object({
  id,
  name: id,
  minReps: positive.int().max(1000),
  maxReps: positive.int().max(1000),
  restSeconds,
  notes: z.string(),
});
const setSchema = z.object({
  id,
  weight: z.number().finite().min(0).max(2000).nullable(),
  reps: z.number().int().min(1).max(1000).nullable(),
  completed: z.boolean(),
});
const exerciseSchema = z.object({
  exerciseId: id,
  name: id,
  minReps: positive.int(),
  maxReps: positive.int(),
  plannedSets: positive.int(),
  restSeconds: restSeconds.default(90),
  sets: z.array(setSchema),
});
const sessionSchema = z.object({
  id,
  templateId: id,
  name: id,
  date,
  startedAt: positive,
  finishedAt: positive.nullable(),
  exercises: z.array(exerciseSchema),
  restTimer: restTimer.default(null),
});
const legacySchema = z.object({
  version: z.literal(1),
  goal: z.object({
    height: positive.max(300),
    startingWeight: positive.max(500),
    targetWeight: positive.max(500),
    goal: z.literal("muscle-gain"),
  }),
  weights: z.array(z.object({ id, date, weight: positive.max(500), note: z.string() })),
  templates: z.array(
    z.object({
      id,
      name: id,
      exercises: z.array(
        z.object({
          id,
          name: id,
          sets: positive.int().max(30),
          minReps: positive.int().max(1000),
          maxReps: positive.int().max(1000),
          restSeconds: restSeconds.default(90),
        }),
      ),
    }),
  ),
  sessions: z.array(sessionSchema),
  draft: sessionSchema.nullable(),
  restDays: z.array(date),
});
export const fitnessSchema = legacySchema.extend({
  version: z.literal(2),
  exerciseLibrary: z.array(libraryExercise),
});

export function migrateFitness(raw: unknown): FitnessData {
  if (typeof raw === "object" && raw !== null && "version" in raw && raw.version === 2)
    return fitnessSchema.parse(raw);
  const old = legacySchema.parse(raw);
  const library = new Map<string, LibraryExercise>(
    emptyFitness().exerciseLibrary.map((e) => [e.id, e]),
  );
  const templates = old.templates.map((t) => ({
    ...t,
    exercises: t.exercises.map((e) => {
      const next = { ...e, restSeconds: defaultRest(e.id) };
      library.set(e.id, {
        id: e.id,
        name: e.name,
        minReps: e.minReps,
        maxReps: e.maxReps,
        restSeconds: next.restSeconds,
        notes: "",
      });
      return next;
    }),
  }));
  const hydrateSession = (s: (typeof old.sessions)[number]) => ({
    ...s,
    restTimer: null,
    exercises: s.exercises.map((e) => {
      if (!library.has(e.exerciseId))
        library.set(e.exerciseId, {
          id: e.exerciseId,
          name: e.name,
          minReps: e.minReps,
          maxReps: e.maxReps,
          restSeconds: defaultRest(e.exerciseId),
          notes: "",
        });
      return { ...e, restSeconds: defaultRest(e.exerciseId) };
    }),
  });
  const sessions = old.sessions.map(hydrateSession);
  const draft = old.draft ? hydrateSession(old.draft) : null;
  return fitnessSchema.parse({
    ...old,
    version: 2,
    templates,
    sessions,
    draft,
    exerciseLibrary: [...library.values()],
  });
}

export function loadFitness(storage: Pick<Storage, "getItem">): FitnessData {
  const raw = storage.getItem(FITNESS_STORAGE_KEY);
  if (!raw) return emptyFitness();
  // Never replace unreadable or newer-version records with empty data.
  return migrateFitness(JSON.parse(raw));
}
export function saveFitness(
  storage: Pick<Storage, "setItem"> & Partial<Pick<Storage, "getItem">>,
  data: FitnessData,
): void {
  fitnessSchema.parse(data);
  const previous = storage.getItem?.(FITNESS_STORAGE_KEY);
  if (previous && JSON.parse(previous).version === 1 && !storage.getItem?.(FITNESS_V1_BACKUP_KEY))
    storage.setItem(FITNESS_V1_BACKUP_KEY, previous);
  storage.setItem(FITNESS_STORAGE_KEY, JSON.stringify(data));
}
