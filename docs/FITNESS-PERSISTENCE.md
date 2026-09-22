# Fitness persistence

Fitness is stored per authenticated Supabase user. `fitness_accounts` contains the atomic versioned Fitness snapshot: weights, workout templates, custom exercises, draft workouts, completed workout sessions (including set records), goals, and rest days. `fitness_progress_photos` stores photo metadata; image bytes are in the private `fitness-progress-photos` bucket under `<auth-user-id>/<photo-id>.jpg`.

The migration is `supabase/migrations/20260921140000_fitness_cloud.sql`. It is safe to re-run and creates owner-only RLS policies for both tables and the storage object policies. The `save_fitness` RPC uses an optimistic revision check so two devices cannot silently overwrite one another. It returns a conflict (`PT409`) when the client revision is stale.

The route loads the cloud snapshot after Supabase authentication. Mutations update the mobile UI immediately, queue writes in order, and only report success after Supabase acknowledges the write. A failed write rolls the UI back to the last acknowledged snapshot and shows the error. Photo uploads first write the private object, then metadata; a metadata failure removes the object again.

Fitness no longer uses localStorage or IndexedDB as its active store. The old `burnlog.fitness.v1` snapshot and local progress photos remain available only through the explicit, ownership-confirmed “匯入此瀏覽器的舊 Fitness 紀錄” flow. The import is idempotent and never deletes the local source.

The live test script is `tests/fitness-cloud.integration.mjs`; it exercises fresh-session restore, account isolation, revision conflicts, private storage access, and photo-only/weight-only independence. Set `FITNESS_TEST_PASSWORD` locally to run it with the synthetic QA accounts. The regular suite is `npm test`.

