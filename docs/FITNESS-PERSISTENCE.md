# Fitness persistence

Fitness is stored per authenticated Supabase user. `fitness_accounts` contains the atomic versioned Fitness snapshot: weights, workout templates, custom exercises, draft workouts, completed workout sessions (including set records), goals, and rest days. `fitness_progress_photos` stores photo metadata; image bytes are in the private `fitness-progress-photos` bucket under `<auth-user-id>/<photo-id>.jpg`.

The migration is `supabase/migrations/20260921140000_fitness_cloud.sql`. It is safe to re-run and creates owner-only RLS policies for both tables and the storage object policies. The `save_fitness` RPC uses an optimistic revision check so two devices cannot silently overwrite one another. It returns a conflict (`PT409`) when the client revision is stale.

The route loads the cloud snapshot after Supabase authentication. Mutations update the mobile UI immediately, queue writes in order, and only report success after Supabase acknowledges the write. A failed write rolls the UI back to the last acknowledged snapshot and shows the error. Photo uploads first write the private object, then metadata; a metadata failure removes the object again.

Fitness no longer uses localStorage or IndexedDB as its active store. The old `burnlog.fitness.v1` snapshot and local progress photos remain available only through the explicit, ownership-confirmed “匯入此瀏覽器的舊 Fitness 紀錄” flow. The import is idempotent and never deletes the local source.

The live test script is `tests/fitness-cloud.integration.mjs`; it exercises fresh-session restore, account isolation, revision conflicts, private storage access, and photo-only/weight-only independence. Set `FITNESS_TEST_PASSWORD` locally to run it with the synthetic QA accounts. The regular suite is `npm test`.

## Upper template compatibility

The fourth template uses the stable ID `upper`. New accounts receive it from `emptyFitness`; existing version-2 cloud snapshots and local imports receive it after schema validation, only when that ID is absent. The original three defaults stay unchanged. Existing templates, library entries, sessions, drafts, weights and calendar data are retained. Shared exercise IDs preserve prior-performance lookup without replacing existing library names or targets. An already saved Upper (including renamed or edited exercises) is never reseeded.

Hydration is read-only: it does not update Supabase or localStorage. The next normal user save includes Upper through the existing ordered queue and revision-checked `save_fitness` RPC. No SQL migration, bulk account update, storage-key change, or reset is needed. Keep the version at 2, and deploy through the existing main-branch Vercel integration. Rolling back the code does not require deleting Upper from saved payloads: the previous schema and UI already accept arbitrary templates.

Regression coverage includes preservation of customized existing templates and library entries, complete history and active drafts, read-without-write, repeat-load idempotence, and edited Upper save/reload/start through the existing sync flow. Run `npm test`, `npm run typecheck`, and `npm run build` before publishing. Real-account data must not be used as a test fixture.

