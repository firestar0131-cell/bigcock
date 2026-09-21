export type WeightEntry = { id: string; date: string; weight: number; note: string };
export type LibraryExercise = {
  id: string;
  name: string;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  notes: string;
};
export type RestTimer = {
  exerciseId: string;
  exerciseName: string;
  durationSeconds: number;
  endsAt: number | null;
};
export type ExerciseTemplate = {
  id: string;
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};
export type WorkoutTemplate = { id: string; name: string; exercises: ExerciseTemplate[] };
export type SetRecord = {
  id: string;
  weight: number | null;
  reps: number | null;
  completed: boolean;
};
export type ExerciseSession = {
  exerciseId: string;
  name: string;
  minReps: number;
  maxReps: number;
  plannedSets: number;
  restSeconds: number;
  sets: SetRecord[];
};
export type WorkoutSession = {
  id: string;
  templateId: string;
  name: string;
  date: string;
  startedAt: number;
  finishedAt: number | null;
  exercises: ExerciseSession[];
  restTimer: RestTimer | null;
};
export type FitnessGoal = {
  height: number;
  startingWeight: number;
  targetWeight: number;
  goal: "muscle-gain";
};
export type FitnessData = {
  version: 2;
  exerciseLibrary: LibraryExercise[];
  goal: FitnessGoal;
  weights: WeightEntry[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  draft: WorkoutSession | null;
  restDays: string[];
};

export const GAIN_RATE = { desiredMin: 0.15, desiredMax: 0.25, below: 0.1, above: 0.3 } as const;
export const DEFAULT_GOAL: FitnessGoal = {
  height: 168,
  startingWeight: 56,
  targetWeight: 60,
  goal: "muscle-gain",
};

const exercise = (
  id: string,
  name: string,
  sets: number,
  minReps: number,
  maxReps: number,
): ExerciseTemplate => ({ id, name, sets, minReps, maxReps, restSeconds: defaultRest(id) });
export function defaultRest(id: string): number {
  return (
    (
      { squat: 180, "romanian-deadlift": 120, "bench-press": 150, "cable-fly": 90 } as Record<
        string,
        number
      >
    )[id] ?? 90
  );
}
export const DEFAULT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "legs",
    name: "LEG DAY",
    exercises: [
      exercise("squat", "Squat", 4, 6, 8),
      exercise("romanian-deadlift", "Romanian Deadlift", 3, 8, 10),
      exercise("leg-press", "Leg Press", 3, 10, 12),
      exercise("leg-extension", "Leg Extension", 3, 10, 15),
      exercise("leg-curl", "Leg Curl", 3, 10, 15),
      exercise("calf-raise", "Calf Raise", 3, 12, 15),
    ],
  },
  {
    id: "chest",
    name: "CHEST DAY",
    exercises: [
      exercise("bench-press", "Bench Press", 4, 6, 8),
      exercise("incline-dumbbell-press", "Incline Dumbbell Press", 3, 8, 10),
      exercise("chest-press", "Chest Press", 3, 10, 12),
      exercise("cable-fly", "Cable Fly / Pec Deck", 3, 12, 15),
      exercise("triceps-pushdown", "Triceps Pushdown", 3, 10, 12),
      exercise("overhead-triceps-extension", "Overhead Triceps Extension", 2, 10, 12),
    ],
  },
  {
    id: "back",
    name: "BACK DAY",
    exercises: [
      exercise("lat-pulldown", "Pull-up / Lat Pulldown", 4, 6, 10),
      exercise("barbell-row", "Barbell Row", 3, 8, 10),
      exercise("seated-cable-row", "Seated Cable Row", 3, 8, 12),
      exercise("single-arm-lat-pulldown", "Single-arm Lat Pulldown", 3, 10, 12),
      exercise("face-pull", "Face Pull", 3, 12, 15),
      exercise("biceps-curl", "Dumbbell / Cable Biceps Curl", 3, 10, 12),
    ],
  },
];

export function emptyFitness(): FitnessData {
  return {
    version: 2,
    exerciseLibrary: DEFAULT_TEMPLATES.flatMap((t) =>
      t.exercises.map(({ sets: _sets, ...e }) => ({ ...e, notes: "" })),
    ),
    goal: { ...DEFAULT_GOAL },
    weights: [],
    templates: structuredClone(DEFAULT_TEMPLATES),
    sessions: [],
    draft: null,
    restDays: [],
  };
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && localDate(new Date(`${date}T12:00:00`)) === date;
}
export function weekStart(date: string): string {
  return shiftDate(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
}
export function weeklySummary(entries: WeightEntry[], today = localDate()) {
  const currentStart = shiftDate(today, -6);
  const previousStart = shiftDate(today, -13);
  const average = (items: WeightEntry[]) =>
    items.length ? items.reduce((sum, e) => sum + e.weight, 0) / items.length : null;
  const valid = entries.filter(
    (e) => validDate(e.date) && Number.isFinite(e.weight) && e.weight > 0,
  );
  const current = valid.filter((e) => e.date >= currentStart && e.date <= today);
  const previous = valid.filter((e) => e.date >= previousStart && e.date < currentStart);
  const currentAverage = average(current);
  const previousAverage = average(previous);
  const change =
    currentAverage === null || previousAverage === null
      ? null
      : Math.round((currentAverage - previousAverage) * 10000) / 10000;
  const status: "insufficient" | "below" | "above" | "within" =
    change === null
      ? "insufficient"
      : change < GAIN_RATE.below
        ? "below"
        : change > GAIN_RATE.above
          ? "above"
          : "within";
  return {
    currentAverage,
    previousAverage,
    change,
    status,
    currentCount: current.length,
    previousCount: previous.length,
    currentStart,
    previousStart,
    today,
  };
}
export function weeklyTrend(entries: WeightEntry[]) {
  const groups = new Map<string, WeightEntry[]>();
  for (const entry of entries) {
    const key = weekStart(entry.date);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      average: items.reduce((sum, e) => sum + e.weight, 0) / items.length,
      count: items.length,
    }));
}
export function blankSet(): SetRecord {
  return { id: crypto.randomUUID(), weight: null, reps: null, completed: false };
}
export function startWorkout(template: WorkoutTemplate): WorkoutSession {
  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    name: template.name,
    date: localDate(),
    startedAt: Date.now(),
    finishedAt: null,
    restTimer: null,
    exercises: template.exercises.map((e) => ({
      exerciseId: e.id,
      name: e.name,
      minReps: e.minReps,
      maxReps: e.maxReps,
      plannedSets: e.sets,
      restSeconds: e.restSeconds,
      sets: Array.from({ length: e.sets }, blankSet),
    })),
  };
}
export function validSet(set: SetRecord): boolean {
  return (
    set.weight !== null &&
    Number.isFinite(set.weight) &&
    set.weight >= 0 &&
    set.weight <= 2000 &&
    set.reps !== null &&
    Number.isInteger(set.reps) &&
    set.reps > 0 &&
    set.reps <= 1000
  );
}
export function volume(exercise: ExerciseSession): number {
  return exercise.sets
    .filter((s) => s.completed && validSet(s))
    .reduce((sum, s) => sum + s.weight! * s.reps!, 0);
}
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string) {
  return sessions
    .filter((s) => s.finishedAt !== null)
    .flatMap((session) => {
      const exercise = session.exercises.find(
        (e) => e.exerciseId === exerciseId && e.sets.some((s) => s.completed && validSet(s)),
      );
      return exercise ? [{ session, exercise, volume: volume(exercise) }] : [];
    })
    .sort(
      (a, b) =>
        b.session.date.localeCompare(a.session.date) || b.session.startedAt - a.session.startedAt,
    );
}
export function previousExercise(
  sessions: WorkoutSession[],
  current: WorkoutSession,
  exerciseId: string,
) {
  return (
    exerciseHistory(
      sessions.filter(
        (s) =>
          s.id !== current.id &&
          (s.date < current.date || (s.date === current.date && s.startedAt < current.startedAt)),
      ),
      exerciseId,
    )[0] ?? null
  );
}
// Only fill entirely untouched rows. Keep today's partial input and completion state.
export function copyPrevious(
  exercise: ExerciseSession,
  previous: ExerciseSession,
): ExerciseSession {
  const sets = previous.sets.filter((s) => s.completed && validSet(s));
  return {
    ...exercise,
    sets: exercise.sets.map((set, i) => {
      const source = sets[i];
      return source && set.weight === null && set.reps === null && !set.completed
        ? { ...set, weight: source.weight, reps: source.reps }
        : set;
    }),
  };
}

export function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}
export function findLibraryExercise<T extends Pick<LibraryExercise, "id" | "name">>(
  library: T[],
  name: string,
) {
  const key = normalizeExerciseName(name);
  return library.find((e) =>
    [e.name, ...e.name.split("/")].some((n) => normalizeExerciseName(n) === key),
  );
}
export function remainingRest(timer: RestTimer | null, now = Date.now()): number {
  return timer?.endsAt == null ? 0 : Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}
export function startRest(exercise: ExerciseSession, now = Date.now()): RestTimer | null {
  return exercise.restSeconds > 0
    ? {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        durationSeconds: exercise.restSeconds,
        endsAt: now + exercise.restSeconds * 1000,
      }
    : null;
}
export function setCompleted(
  session: WorkoutSession,
  exerciseId: string,
  setId: string,
  completed: boolean,
  now = Date.now(),
): WorkoutSession {
  const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
  const set = exercise?.sets.find((s) => s.id === setId);
  if (!exercise || !set || (completed && !validSet(set))) return session;
  return {
    ...session,
    exercises: session.exercises.map((e) =>
      e.exerciseId === exerciseId
        ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, completed } : s)) }
        : e,
    ),
    restTimer:
      completed && !set.completed && session.finishedAt === null
        ? startRest(exercise, now)
        : session.restTimer,
  };
}
// Conservative hint: enough sets, all completed at the current upper rep target, same positive load.
// This avoids recommending a heavier load after an incomplete or mixed-load workout.
export function reachedRepTarget(
  previous: ExerciseSession | null,
  target: ExerciseSession,
): boolean {
  if (!previous || previous.sets.length < target.plannedSets) return false;
  const sets = previous.sets;
  const load = sets[0]?.weight;
  return (
    load != null &&
    load > 0 &&
    sets.every((s) => s.completed && validSet(s) && s.weight === load && s.reps! >= target.maxReps)
  );
}
