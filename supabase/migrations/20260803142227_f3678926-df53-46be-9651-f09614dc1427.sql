ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_folder boolean NOT NULL DEFAULT false;

UPDATE public.services p
SET is_folder = true
WHERE EXISTS (SELECT 1 FROM public.services c WHERE c.parent_id = p.id);