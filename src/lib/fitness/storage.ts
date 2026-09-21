import { z } from "zod";
import { emptyFitness, validDate, type FitnessData } from "./model.ts";

export const FITNESS_STORAGE_KEY = "burnlog.fitness.v1";
const date = z.string().refine(validDate);
const id = z.string().min(1);
const positive = z.number().finite().positive();
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
});
export const fitnessSchema = z.object({
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
        }),
      ),
    }),
  ),
  sessions: z.array(sessionSchema),
  draft: sessionSchema.nullable(),
  restDays: z.array(date),
});

export function loadFitness(storage: Pick<Storage, "getItem">): FitnessData {
  const raw = storage.getItem(FITNESS_STORAGE_KEY);
  if (!raw) return emptyFitness();
  // Never replace unreadable or newer-version records with empty data.
  return fitnessSchema.parse(JSON.parse(raw));
}
export function saveFitness(storage: Pick<Storage, "setItem">, data: FitnessData): void {
  fitnessSchema.parse(data);
  storage.setItem(FITNESS_STORAGE_KEY, JSON.stringify(data));
}
