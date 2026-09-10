CREATE TABLE public.body_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  taken_on DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC(5,1),
  photo_path TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, taken_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_entries TO authenticated;
GRANT ALL ON public.body_entries TO service_role;

ALTER TABLE public.body_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own body entries" ON public.body_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own body entries" ON public.body_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own body entries" ON public.body_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own body entries" ON public.body_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER body_entries_set_updated_at
BEFORE UPDATE ON public.body_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();