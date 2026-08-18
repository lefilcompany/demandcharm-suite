ALTER TABLE public.platform_releases
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_releases_approval_status_check'
  ) THEN
    ALTER TABLE public.platform_releases
      ADD CONSTRAINT platform_releases_approval_status_check
      CHECK (approval_status IN ('pending_approval','approved','rejected'));
  END IF;
END $$;

UPDATE public.platform_releases
SET approval_status = 'approved', approved_at = COALESCE(approved_at, updated_at, created_at)
WHERE approval_status = 'pending_approval'
  AND status IN ('processing','completed','partial','failed');

CREATE INDEX IF NOT EXISTS platform_releases_approval_status_idx
  ON public.platform_releases (approval_status, created_at DESC);