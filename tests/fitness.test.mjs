import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyFitness,
  DEFAULT_TEMPLATES,
  weeklySummary,
  weeklyTrend,
  validDate,
  shiftDate,
  weekStart,
  startWorkout,
  blankSet,
  validSet,
  volume,
  previousExercise,
  copyPrevious,
  exerciseHistory,
} from "../src/lib/fitness/model.ts";
import { FITNESS_STORAGE_KEY, loadFitness, saveFitness } from "../src/lib/fitness/storage.ts";

const weight = (date, value) => ({ id: date, date, weight: value, note: "" });
const doneSet = (weight = 40, reps = 8) => ({ ...blankSet(), weight, reps, completed: true });
function session(date, startedAt, exerciseId = "bench-press") {
  const result = startWorkout(DEFAULT_TEMPLATES[1]);
  result.date = date;
  result.startedAt = startedAt;
  result.finishedAt = startedAt + 1000;
  result.exercises = [
    { ...result.exercises[0], exerciseId, sets: [doneSet(), doneSet(), doneSet(40, 7)] },
  ];
  return result;
}
test("sparse weeks use only measurements and exact rolling boundaries", () => {
  const result = weeklySummary(
    [
      weight("2026-09-21", 56.3),
      weight("2026-09-18", 56.2),
      weight("2026-09-15", 56.1),
      weight("2026-09-14", 56.2),
      weight("2026-09-11", 56),
      weight("2026-09-08", 55.8),
      weight("2026-09-07", 100),
      weight("2026-09-22", 100),
    ],
    "2026-09-21",
  );
  assert.equal(result.currentCount, 3);
  assert.equal(result.previousCount, 3);
  assert.ok(Math.abs(result.currentAverage - 56.2) < 1e-9);
  assert.equal(result.previousAverage, 56);
  assert.equal(result.change, 0.2);
  assert.equal(result.status, "within");
});
test("no data and missing comparison week never invent a change", () => {
  assert.equal(weeklySummary([], "2026-09-21").change, null);
  const one = weeklySummary([weight("2026-09-21", 56)], "2026-09-21");
  assert.equal(one.currentAverage, 56);
  assert.equal(one.previousAverage, null);
  assert.equal(one.status, "insufficient");
});
test("status includes both threshold boundaries despite floating-point subtraction", () => {
  for (const [change, status] of [
    [-0.2, "below"],
    [0.099, "below"],
    [0.1, "within"],
    [0.3, "within"],
    [0.301, "above"],
  ]) {
    assert.equal(
      weeklySummary([weight("2026-09-21", 56 + change), weight("2026-09-14", 56)], "2026-09-21")
        .status,
      status,
    );
  }
});
test("calendar calculations handle Sunday, leap days, year transitions and DST", () => {
  assert.equal(weekStart("2026-09-20"), "2026-09-14");
  assert.equal(weekStart("2026-09-21"), "2026-09-21");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftDate("2026-03-09", -1), "2026-03-08");
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
});
test("weekly chart averages sparse observations without creating fake weeks", () => {
  assert.deepEqual(
    weeklyTrend([weight("2026-09-16", 56.4), weight("2026-09-14", 56), weight("2026-08-31", 55)]),
    [
      { date: "2026-08-31", average: 55, count: 1 },
      { date: "2026-09-14", average: 56.2, count: 2 },
    ],
  );
});
test("templates and sessions are independent snapshots", () => {
  const data = emptyFitness();
  const workout = startWorkout(data.templates[0]);
  data.templates[0].exercises[0].name = "Renamed";
  assert.equal(workout.exercises[0].name, "Squat");
  assert.equal(DEFAULT_TEMPLATES[0].exercises[0].name, "Squat");
  assert.equal(workout.exercises[0].sets.length, 4);
  assert.equal(new Set(workout.exercises.flatMap((e) => e.sets.map((s) => s.id))).size, 19);
});
test("previous workout uses stable exercise identity and chronological order across templates", () => {
  const earlier = session("2026-09-18", 100);
  const recent = session("2026-09-20", 200);
  recent.templateId = "custom";
  recent.exercises[0].name = "Renamed bench";
  const today = session("2026-09-21", 300);
  const future = session("2026-09-22", 400);
  const draft = { ...session("2026-09-21", 250), finishedAt: null };
  assert.equal(
    previousExercise([future, earlier, today, draft, recent], today, "bench-press").session.id,
    recent.id,
  );
  assert.equal(previousExercise([earlier], today, "squat"), null);
  assert.equal(previousExercise([future, today], recent, "bench-press"), null);
});
test("copy previous preserves partial input and completion flags", () => {
  const previous = session("2026-09-20", 100).exercises[0];
  const current = {
    ...previous,
    sets: [blankSet(), { ...blankSet(), weight: 45 }, { ...blankSet(), reps: 6 }, doneSet(50, 5)],
  };
  const result = copyPrevious(current, previous);
  assert.equal(result.sets[0].weight, 40);
  assert.equal(result.sets[0].reps, 8);
  assert.equal(result.sets[0].completed, false);
  assert.deepEqual(result.sets.slice(1), current.sets.slice(1));
  assert.equal(current.sets[0].weight, null);
});
test("volume and exercise history count only valid completed sets", () => {
  const record = session("2026-09-20", 100);
  record.exercises[0].sets = [
    doneSet(),
    doneSet(),
    doneSet(),
    { ...doneSet(100, 10), completed: false },
    { ...doneSet(), reps: null },
  ];
  assert.equal(volume(record.exercises[0]), 960);
  assert.equal(exerciseHistory([record], "bench-press")[0].volume, 960);
  assert.equal(validSet(doneSet(0, 10)), true);
  assert.equal(validSet(doneSet(-1, 10)), false);
  assert.equal(validSet(doneSet(40, 0)), false);
  assert.equal(validSet(doneSet(40, 1.5)), false);
});
test("storage round trip restores active sets, templates and history", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const data = emptyFitness();
  data.draft = startWorkout(data.templates[1]);
  data.draft.exercises[0].sets[0] = doneSet();
  data.weights = [weight("2026-09-21", 56.2)];
  data.restDays = ["2026-09-19"];
  data.sessions = [session("2026-09-20", 100)];
  saveFitness(storage, data);
  assert.deepEqual(loadFitness(storage), data);
  assert.equal(memory.size, 1);
  assert.ok(memory.has(FITNESS_STORAGE_KEY));
});
test("corrupt and newer data stay untouched, storage failures propagate", () => {
  let raw = '{"version":2}';
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  assert.throws(() => loadFitness(storage));
  assert.equal(raw, '{"version":2}');
  raw = "broken";
  assert.throws(() => loadFitness(storage));
  assert.equal(raw, "broken");
  assert.throws(
    () =>
      saveFitness(
        {
          setItem() {
            throw new Error("quota");
          },
        },
        emptyFitness(),
      ),
    /quota/,
  );
});
