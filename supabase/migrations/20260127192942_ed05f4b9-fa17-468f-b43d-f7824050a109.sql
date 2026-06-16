-- Allow recipients to remove their own access to a shared note (leave shared note)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'note_shares'
      AND policyname = 'Users can leave shared notes'
  ) THEN
    CREATE POLICY "Users can leave shared notes"
    ON public.note_shares
    FOR DELETE
    TO authenticated
    USING (shared_with_user_id = auth.uid());
  END IF;
END $$;