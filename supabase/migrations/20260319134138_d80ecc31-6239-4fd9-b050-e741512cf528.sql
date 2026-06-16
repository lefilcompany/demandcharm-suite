-- Remove vulnerable self-join policy (privilege escalation)
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;
DROP POLICY IF EXISTS "Team members can add self" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members;

-- Secure member insertion paths
CREATE POLICY "Team creators can add self as owner"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'owner'::public.team_membership_role
  AND public.is_team_creator(auth.uid(), team_id)
);

CREATE POLICY "Team owners can add members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_owner(auth.uid(), team_id)
  AND role = 'member'::public.team_membership_role
);

-- Ensure no public team exposure policies remain
DROP POLICY IF EXISTS "Anonymous can view team basic info for shared demands" ON public.teams;
DROP POLICY IF EXISTS "Authenticated can view team info for shared content" ON public.teams;

-- Tighten demand share token policies to authenticated users only
DROP POLICY IF EXISTS "Public can verify share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Authenticated can verify share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Board members can create share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Board members can view share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Board members can update share tokens" ON public.demand_share_tokens;
DROP POLICY IF EXISTS "Board members can delete share tokens" ON public.demand_share_tokens;

CREATE POLICY "Board members can create share tokens"
ON public.demand_share_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND demand_id IN (
    SELECT d.id
    FROM public.demands d
    WHERE d.board_id IN (SELECT public.get_user_board_ids(auth.uid()))
  )
);

CREATE POLICY "Board members can view share tokens"
ON public.demand_share_tokens
FOR SELECT
TO authenticated
USING (
  demand_id IN (
    SELECT d.id
    FROM public.demands d
    WHERE d.board_id IN (SELECT public.get_user_board_ids(auth.uid()))
  )
);

CREATE POLICY "Board members can update share tokens"
ON public.demand_share_tokens
FOR UPDATE
TO authenticated
USING (
  demand_id IN (
    SELECT d.id
    FROM public.demands d
    WHERE d.board_id IN (SELECT public.get_user_board_ids(auth.uid()))
  )
)
WITH CHECK (
  demand_id IN (
    SELECT d.id
    FROM public.demands d
    WHERE d.board_id IN (SELECT public.get_user_board_ids(auth.uid()))
  )
);

CREATE POLICY "Board members can delete share tokens"
ON public.demand_share_tokens
FOR DELETE
TO authenticated
USING (
  demand_id IN (
    SELECT d.id
    FROM public.demands d
    WHERE d.board_id IN (SELECT public.get_user_board_ids(auth.uid()))
  )
);

-- Tighten note share token policies to authenticated users only
DROP POLICY IF EXISTS "Public can verify share tokens" ON public.note_share_tokens;
DROP POLICY IF EXISTS "Team members can create share tokens" ON public.note_share_tokens;
DROP POLICY IF EXISTS "Team members can view share tokens" ON public.note_share_tokens;
DROP POLICY IF EXISTS "Token creators can update their tokens" ON public.note_share_tokens;
DROP POLICY IF EXISTS "Token creators can delete their tokens" ON public.note_share_tokens;

CREATE POLICY "Team members can create share tokens"
ON public.note_share_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND note_id IN (
    SELECT n.id
    FROM public.notes n
    WHERE public.is_team_member(auth.uid(), n.team_id)
  )
);

CREATE POLICY "Team members can view share tokens"
ON public.note_share_tokens
FOR SELECT
TO authenticated
USING (
  note_id IN (
    SELECT n.id
    FROM public.notes n
    WHERE public.is_team_member(auth.uid(), n.team_id)
  )
);

CREATE POLICY "Token creators can update their tokens"
ON public.note_share_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Token creators can delete their tokens"
ON public.note_share_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);