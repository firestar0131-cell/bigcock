-- Optional cloud photo adapter. Local IndexedDB mode works without this migration.
-- Apply with the project's normal Supabase migration workflow before enabling the adapter.
CREATE TABLE public.fitness_progress_photos (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  image_ref text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT '' CHECK (category IN ('', 'front', 'side', 'back', 'other')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (image_ref = user_id::text || '/' || id::text || '.jpg')
);
CREATE INDEX fitness_progress_photos_user_date ON public.fitness_progress_photos(user_id, date DESC);
ALTER TABLE public.fitness_progress_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fitness_progress_photos FROM anon;
GRANT SELECT, INSERT, DELETE ON public.fitness_progress_photos TO authenticated;
CREATE POLICY fitness_photos_select ON public.fitness_progress_photos FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_photos_insert ON public.fitness_progress_photos FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fitness_photos_delete ON public.fitness_progress_photos FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fitness-progress-photos', 'fitness-progress-photos', false, 10485760, ARRAY['image/jpeg']);

CREATE POLICY fitness_images_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY fitness_images_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY fitness_images_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fitness-progress-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- No anon access, public URLs, service-role keys in the browser, or policies for other buckets.
-- No foreign key to WeightEntry: deleting a photo never deletes a weight, or vice versa.
