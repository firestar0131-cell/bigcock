# Fitness v1.1

Extends the existing `/fitness` module and `codex/fitness-tracking` branch. The original weight, workout, history, progress charts and defaults remain available.

## Workout changes

- Completing a valid set starts the exercise's rest timer. The persisted deadline survives page reloads, tab changes and background throttling. +30 seconds, skip and restart are available. No background alarm or notification is promised.
- Initial rests: Squat 180s, Romanian Deadlift 120s, Bench Press 150s, Cable Fly 90s; other exercises 90s. Edit template rests from 0 (disabled) to 3600s.
- Templates support names, exercise ordering/removal, sets, rep ranges and rest. New sessions copy a snapshot; existing drafts and history never change when a template changes.
- A shared exercise library has stable IDs, default reps/rest and optional notes. Custom names normalize case, Unicode, whitespace and punctuation; slash-separated default aliases reuse the existing exercise. Template overrides remain specific to that template.
- The progression hint requires enough previous sets, every previous set valid and completed at or above the current upper rep target, and one consistent positive load. It never chooses an increment or changes entered weights. Incomplete, mixed-load and bodyweight-only data do not produce a hint.

## Compatibility

The storage key remains `burnlog.fitness.v1`; the payload is schema version 2. Version 1 loads through a backward-compatible migration preserving IDs, weights, template edits, sessions, draft sets, rest days and goals. Before the first version 2 write, the original payload is saved once to `burnlog.fitness.v1.backup`. A backup failure prevents overwriting the original. Invalid or newer data are not reset to empty records.

## Independent progress photos

Photos are separate records with ID, date, image reference, optional category/note and creation time. They have no required WeightEntry reference. Weight-only, photo-only, both, and multiple photos on one date are valid. Deleting either type does not delete the other. The timeline joins dates for display only. Full preview, two-photo comparison and dashboard latest-photo access are included.

### Production default: local IndexedDB

The existing app has no shared authenticated sign-in flow. Its older body-photo code uses a local UUID fallback, and references `body_logs` whereas the existing migration defines `body_entries`. Reusing that path would not establish verified per-user isolation.

Therefore this release defaults to browser-local IndexedDB (`burnlog.progress-photos`, `photos` store), storing metadata and image Blob atomically. Photos never become localStorage base64 or public objects. JPEG/PNG/WebP inputs up to 10 MB are decoded, resized to a maximum edge of 2048 pixels, then re-encoded as JPEG to remove EXIF metadata. UI explains that photos stay on this browser, do not sync, and are lost if site data are cleared. The existing Today-page photo implementation is unchanged.

### Optional private Supabase mode

The private cloud adapter and migration are included but are **not activated or live-tested** in this release. Local mode needs no environment changes or migration.

To activate cloud mode in a future deployment:

1. Provide a real Supabase authenticated session in the app using the intended Supabase project. Never use a locally generated UUID as an authenticated identity. The existing client currently contains the project's public URL/publishable key; confirm that project before migration.
2. Apply `supabase/migrations/20260921080000_fitness_progress_photos.sql` to that project. It creates an independent table, per-user RLS, a private `fitness-progress-photos` bucket, and authenticated storage policies scoped to the user's folder. Do not make the bucket public or add a service-role key to the frontend.
3. Verify with two test accounts that each can upload/read/delete its own objects and cannot access the other account's table rows or storage paths; verify anonymous access fails.
4. Set Vercel `VITE_FITNESS_PHOTO_STORAGE=supabase` for the intended environment and rebuild. Without this exact value, local mode remains active.

Cloud paths are `<auth.uid()>/<photo-id>.jpg`. Every repository operation checks the authenticated user; image access uses authenticated downloads, not public URLs. Upload metadata failure triggers object cleanup; deletion failures remain visible for retry. Cloud authentication/setup errors never silently switch to local mode. Existing local photos are not automatically uploaded or migrated when enabling cloud mode.

## Validation

- 21 Node tests: original 11 plus 10 covering migration/backup failures, timer deadlines, library identity, immutable snapshots, conservative overload conditions, independent timeline and file validation.
- TypeScript and targeted Fitness ESLint pass.
- Full repository ESLint: 188 errors and 6 warnings, matching the pre-existing baseline; no new Fitness lint errors.
- Production Vite build passes (existing plugin and large-chunk warnings remain).
- Real Chromium UI checks: existing v1 records remain visible; valid set starts timer; +30, skip, restart, tab switching and reload retain appropriate timing; custom exercise creation and case/punctuation duplicate prevention; reordered template and edited rest values; prior performance and upper-rep hint with blank new weights; photo-only dates, same-date multiple photos and weights, persistent reload, full preview, comparison, and independent deletion of test photos/weights.
- Responsive checks at 390px and 320px: no horizontal document overflow. This is browser viewport testing, not a physical iOS/Android lock-screen test; timestamp math covers elapsed-time recovery independently.

## Deployment configuration

Vercel project `firestar/bigcock` was inspected while signed in. Its Production branch is `main` (explicit overview instruction), framework is TanStack Start, Node is 24.x, root is empty and command overrides are disabled. Integrate via the original PR using a merge commit; do not rewrite published history because this repository is connected to Lovable. Confirm the resulting production deployment is Ready and the live `/fitness` page has the new photo and workout controls.
