create or replace function public.hub_metrics_by_email()
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (
    select lower(p.email) as email, to_char(dm.delivered_at at time zone 'America/Sao_Paulo','YYYY-MM') as m, count(*)::int as c
    from public.demands dm
    join public.demand_assignees da on da.demand_id = dm.id and da.is_primary
    join public.profiles p on p.id = da.user_id
    where dm.delivered_at is not null and p.email is not null
    group by 1,2
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'total', total, 'months', months)), '[]'::jsonb)
  from (select email, sum(c)::int as total, jsonb_object_agg(m, c) as months from d group by email) u;
$$;
revoke execute on function public.hub_metrics_by_email() from public, anon, authenticated;
grant execute on function public.hub_metrics_by_email() to service_role;