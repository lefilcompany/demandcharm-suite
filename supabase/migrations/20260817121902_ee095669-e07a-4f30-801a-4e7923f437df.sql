WITH req AS (
  UPDATE public.team_join_requests r
  SET status = 'approved', responded_at = now()
  WHERE r.id = 'd6ddbb34-c68a-4fd9-bed4-fc325ad2e712' AND r.status = 'pending'
  RETURNING r.team_id, r.user_id
)
INSERT INTO public.team_members (team_id, user_id, role)
SELECT team_id, user_id, 'requester'::team_role FROM req
ON CONFLICT (team_id, user_id) DO NOTHING;