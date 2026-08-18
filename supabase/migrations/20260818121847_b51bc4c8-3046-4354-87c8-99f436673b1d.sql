create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.release_detection_log (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  prod_url text,
  release_key text,
  release_id uuid,
  status text not null,
  error text
);

grant select on public.release_detection_log to authenticated;
grant all on public.release_detection_log to service_role;

alter table public.release_detection_log enable row level security;

drop policy if exists "Global admins can view release detection log" on public.release_detection_log;
create policy "Global admins can view release detection log"
on public.release_detection_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'release_detection_cron_token') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'release_detection_cron_token',
      'Token used by pg_cron to authenticate calls to detect-production-release'
    );
  end if;
end $$;

create or replace function public.get_release_detection_cron_token()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'release_detection_cron_token' limit 1;
$$;

revoke all on function public.get_release_detection_cron_token() from public, anon, authenticated;
grant execute on function public.get_release_detection_cron_token() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'detect-production-release') then
    perform cron.unschedule('detect-production-release');
  end if;
end $$;

select cron.schedule(
  'detect-production-release',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://erxhxmetrvkigjwxchbj.supabase.co/functions/v1/detect-production-release',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_release_detection_cron_token()
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $job$
);