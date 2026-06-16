-- Allow team admins/moderators to manage board_members (add/remove/update) for boards in their team

create or replace function public.is_team_admin_or_moderator_for_board(_user_id uuid, _board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    join public.team_members tm
      on tm.team_id = b.team_id
    where b.id = _board_id
      and tm.user_id = _user_id
      and tm.role in ('admin'::public.team_role, 'moderator'::public.team_role)
  );
$$;

-- Policies (idempotent)
drop policy if exists "Team admins/moderators can add board members" on public.board_members;
create policy "Team admins/moderators can add board members"
on public.board_members
for insert
with check (public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));

drop policy if exists "Team admins/moderators can remove board members" on public.board_members;
create policy "Team admins/moderators can remove board members"
on public.board_members
for delete
using (public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));

drop policy if exists "Team admins/moderators can update board members" on public.board_members;
create policy "Team admins/moderators can update board members"
on public.board_members
for update
using (public.is_team_admin_or_moderator_for_board(auth.uid(), board_id))
with check (public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));
