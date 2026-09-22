BEGIN;
-- Keep the existing module's complete snapshot atomic: weights, templates,
-- exercise library, sessions (including exercise/set records), draft, goal, rest days.
CREATE TABLE IF NOT EXISTS public.fitness_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fitness_payload_shape CHECK (coalesce((
    payload->>'version' = '2' AND
    jsonb_typeof(payload->'weights') = 'array' AND
    jsonb_typeof(payload->'templates') = 'array' AND
    jsonb_typeof(payload->'exerciseLibrary') = 'array' AND
    jsonb_typeof(payload->'sessions') = 'array' AND
    jsonb_typeof(payload->'goal') = 'object' AND
    jsonb_typeof(payload->'restDays') = 'array' AND
    payload ? 'draft'
  ), false))
);
ALTER TABLE public.fitness_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fitness_accounts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_accounts TO authenticated;
DROP POLICY IF EXISTS fitness_accounts_select ON public.fitness_accounts;
DROP POLICY IF EXISTS fitness_accounts_insert ON public.fitness_accounts;
DROP POLICY IF EXISTS fitness_accounts_update ON public.fitness_accounts;
DROP POLICY IF EXISTS fitness_accounts_delete ON public.fitness_accounts;
CREATE POLICY fitness_accounts_select ON public.fitness_accounts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_accounts_insert ON public.fitness_accounts FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_accounts_update ON public.fitness_accounts FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_accounts_delete ON public.fitness_accounts FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.save_fitness(expected_user uuid, expected_revision bigint, next_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.fitness_accounts;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> expected_user THEN RAISE EXCEPTION 'Authentication required for expected account' USING ERRCODE = '42501'; END IF;
  UPDATE public.fitness_accounts
    SET payload = next_payload, revision = revision + 1, updated_at = now()
    WHERE user_id = auth.uid() AND revision = expected_revision
    RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fitness revision conflict' USING ERRCODE = 'PT409'; END IF;
  RETURN jsonb_build_object('payload', saved.payload, 'revision', saved.revision);
END;
$$;
REVOKE ALL ON FUNCTION public.save_fitness(uuid,bigint,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_fitness(uuid,bigint,jsonb) TO authenticated;

-- Self-contained for projects where the optional v1.1 photo migration was not applied.
CREATE TABLE IF NOT EXISTS public.fitness_progress_photos (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  image_ref text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT '' CHECK (category IN ('', 'front', 'side', 'back', 'other')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (image_ref = user_id::text || '/' || id::text || '.jpg')
);
CREATE INDEX IF NOT EXISTS fitness_progress_photos_user_date ON public.fitness_progress_photos(user_id, date DESC);
ALTER TABLE public.fitness_progress_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fitness_progress_photos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_progress_photos TO authenticated;
DROP POLICY IF EXISTS fitness_photos_select ON public.fitness_progress_photos;
DROP POLICY IF EXISTS fitness_photos_insert ON public.fitness_progress_photos;
DROP POLICY IF EXISTS fitness_photos_delete ON public.fitness_progress_photos;
CREATE POLICY fitness_photos_select ON public.fitness_progress_photos FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_photos_insert ON public.fitness_progress_photos FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_photos_update ON public.fitness_progress_photos FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_photos_delete ON public.fitness_progress_photos FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('fitness-progress-photos','fitness-progress-photos',false,10485760,ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS fitness_images_select ON storage.objects;
DROP POLICY IF EXISTS fitness_images_insert ON storage.objects;
DROP POLICY IF EXISTS fitness_images_update ON storage.objects;
DROP POLICY IF EXISTS fitness_images_delete ON storage.objects;
CREATE POLICY fitness_images_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY fitness_images_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY fitness_images_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text) WITH CHECK (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY fitness_images_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
COMMIT;

