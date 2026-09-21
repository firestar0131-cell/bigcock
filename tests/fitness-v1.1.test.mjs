import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyFitness,
  startWorkout,
  setCompleted,
  remainingRest,
  reachedRepTarget,
  findLibraryExercise,
  previousExercise,
} from "../src/lib/fitness/model.ts";
import {
  migrateFitness,
  loadFitness,
  saveFitness,
  FITNESS_STORAGE_KEY,
  FITNESS_V1_BACKUP_KEY,
} from "../src/lib/fitness/storage.ts";
import { newPhoto, photoTimeline, validatePhotoFile } from "../src/lib/fitness/photos.ts";

function workout() {
  return startWorkout(emptyFitness().templates[1]);
}
function complete(exercise, weight = 40, reps = 8) {
  return { ...exercise, sets: exercise.sets.map((s) => ({ ...s, weight, reps, completed: true })) };
}
function legacyData() {
  const data = emptyFitness();
  data.weights = [{ id: "weight", date: "2026-09-21", weight: 56.2, note: "keep" }];
  const finished = workout();
  finished.finishedAt = finished.startedAt + 5000;
  finished.exercises[0] = complete(finished.exercises[0]);
  data.sessions = [finished];
  data.draft = workout();
  data.templates[0].name = "My legs";
  const raw = JSON.parse(JSON.stringify(data));
  raw.version = 1;
  delete raw.exerciseLibrary;
  raw.templates.forEach((t) => t.exercises.forEach((e) => delete e.restSeconds));
  [...raw.sessions, raw.draft].forEach((s) => {
    delete s.restTimer;
    s.exercises.forEach((e) => delete e.restSeconds);
  });
  return raw;
}
test("v1 migration preserves weights, templates, historical sets, identifiers and draft", () => {
  const old = legacyData();
  const oldJson = JSON.stringify(old);
  const migrated = migrateFitness(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.templates[0].name, "My legs");
  assert.deepEqual(migrated.weights, old.weights);
  assert.deepEqual(migrated.sessions[0].exercises[0].sets, old.sessions[0].exercises[0].sets);
  assert.equal(migrated.draft.id, old.draft.id);
  assert.equal(migrated.sessions[0].id, old.sessions[0].id);
  assert.equal(migrated.templates[0].exercises[0].restSeconds, 180);
  assert.equal(migrated.draft.exercises[0].restSeconds, 150);
  assert.equal(JSON.stringify(old), oldJson);
  assert.deepEqual(migrateFitness(migrated), migrated);
});
test("migration backs up v1 before first write and never overwrites that backup", () => {
  const old = JSON.stringify(legacyData());
  const memory = new Map([[FITNESS_STORAGE_KEY, old]]);
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  const data = loadFitness(storage);
  assert.equal(memory.get(FITNESS_STORAGE_KEY), old);
  saveFitness(storage, data);
  assert.equal(memory.get(FITNESS_V1_BACKUP_KEY), old);
  saveFitness(storage, { ...data, restDays: ["2026-09-19"] });
  assert.equal(memory.get(FITNESS_V1_BACKUP_KEY), old);
});
test("backup storage failure leaves original data intact", () => {
  const old = JSON.stringify(legacyData());
  let raw = old;
  const storage = {
    getItem: (key) => (key === FITNESS_STORAGE_KEY ? raw : null),
    setItem: (key, value) => {
      if (key === FITNESS_V1_BACKUP_KEY) throw Error("quota");
      raw = value;
    },
  };
  assert.throws(() => saveFitness(storage, migrateFitness(JSON.parse(old))), /quota/);
  assert.equal(raw, old);
});
test("completed set starts persisted rest timestamp; time continues across background and reload", () => {
  const session = workout();
  const ex = session.exercises[0];
  ex.sets[0] = { ...ex.sets[0], weight: 40, reps: 8 };
  const next = setCompleted(session, ex.exerciseId, ex.sets[0].id, true, 100000);
  assert.equal(next.restTimer.endsAt, 250000);
  assert.equal(remainingRest(next.restTimer, 100000), 150);
  assert.equal(remainingRest(JSON.parse(JSON.stringify(next.restTimer)), 191000), 59);
  assert.equal(remainingRest(next.restTimer, 300000), 0);
  assert.equal(
    setCompleted(next, ex.exerciseId, ex.sets[0].id, true, 200000).restTimer.endsAt,
    250000,
  );
  assert.equal(remainingRest({ ...next.restTimer, endsAt: null }), 0);
});
test("invalid sets, historical edits and disabled rest never start a timer", () => {
  const s = workout();
  const e = s.exercises[0];
  assert.equal(setCompleted(s, e.exerciseId, e.sets[0].id, true).restTimer, null);
  e.sets[0] = { ...e.sets[0], weight: 40, reps: 8 };
  s.finishedAt = Date.now();
  assert.equal(setCompleted(s, e.exerciseId, e.sets[0].id, true).restTimer, null);
  s.finishedAt = null;
  e.restSeconds = 0;
  assert.equal(setCompleted(s, e.exerciseId, e.sets[0].id, true).restTimer, null);
});
test("shared library prevents case, space and punctuation duplicates and recognizes default aliases", () => {
  const library = emptyFitness().exerciseLibrary;
  assert.equal(findLibraryExercise(library, "  BENCH-press ").id, "bench-press");
  assert.equal(findLibraryExercise(library, "Lat Pulldown").id, "lat-pulldown");
  assert.equal(findLibraryExercise(library, "Cable Fly").id, "cable-fly");
  assert.equal(findLibraryExercise(library, "New custom movement"), undefined);
});
test("library exercise can appear in another template while previous workouts stay connected", () => {
  const data = emptyFitness();
  const old = workout();
  old.date = "2026-09-19";
  old.finishedAt = Date.now();
  old.exercises[0] = complete(old.exercises[0]);
  const customTemplate = {
    id: "mixed",
    name: "Mixed",
    exercises: [data.templates[1].exercises[0]],
  };
  const current = startWorkout(customTemplate);
  current.date = "2026-09-21";
  assert.equal(previousExercise([old], current, "bench-press").session.id, old.id);
  customTemplate.exercises[0] = {
    ...customTemplate.exercises[0],
    name: "New name",
    restSeconds: 30,
    sets: 1,
  };
  assert.equal(old.exercises[0].name, "Bench Press");
  assert.equal(old.exercises[0].restSeconds, 150);
  assert.equal(old.exercises[0].sets.length, 4);
});
test("overload hint requires all prescribed sets at current upper reps and one positive load", () => {
  const target = workout().exercises[0];
  const prior = complete(target);
  assert.equal(reachedRepTarget(prior, target), true);
  assert.equal(reachedRepTarget(complete(target, 42.5, 7), target), false);
  assert.equal(reachedRepTarget({ ...prior, sets: prior.sets.slice(0, 3) }, target), false);
  assert.equal(
    reachedRepTarget(
      { ...prior, sets: prior.sets.map((s, i) => (i ? s : { ...s, completed: false })) },
      target,
    ),
    false,
  );
  assert.equal(
    reachedRepTarget(
      { ...prior, sets: prior.sets.map((s, i) => (i ? s : { ...s, weight: 45 })) },
      target,
    ),
    false,
  );
  assert.equal(reachedRepTarget(complete(target, 0, 8), target), false);
  assert.equal(reachedRepTarget(null, target), false);
  assert.equal(reachedRepTarget(prior, { ...target, maxReps: 10 }), false);
});
test("timeline supports weight-only, photo-only, both and multiple photos independently", () => {
  const weights = [
    { id: "w1", date: "2026-09-07", weight: 55.8, note: "" },
    { id: "w2", date: "2026-09-21", weight: 56.2, note: "" },
  ];
  const photos = [
    newPhoto({ date: "2026-09-14", category: "front", note: "" }),
    ...["front", "side", "back"].map((category) =>
      newPhoto({ date: "2026-09-21", category, note: "" }),
    ),
  ];
  const timeline = photoTimeline(photos, weights);
  assert.equal(timeline[0].photos.length, 3);
  assert.equal(timeline[0].weight.weight, 56.2);
  assert.equal(timeline[1].weight, null);
  assert.equal(timeline[1].photos.length, 1);
  assert.equal(timeline[2].photos.length, 0);
  assert.equal(timeline[2].weight.weight, 55.8);
  assert.equal(photoTimeline(photos.slice(0, 1), weights)[0].weight.id, "w2");
  assert.equal(photoTimeline(photos, [weights[0]])[0].photos.length, 3);
  assert.equal(weights.length, 2);
  assert.equal(photos.length, 4);
});
test("photo records need no weight and reject unsafe file types and oversized uploads", () => {
  const p = newPhoto({ date: "2026-09-21", category: "", note: "" });
  assert.equal("weight" in p, false);
  assert.ok(p.imageRef);
  assert.throws(() => validatePhotoFile({ type: "image/svg+xml", size: 500 }));
  assert.throws(() => validatePhotoFile({ type: "image/jpeg", size: 11 * 1024 * 1024 }));
  assert.doesNotThrow(() => validatePhotoFile({ type: "image/png", size: 1024 }));
});
