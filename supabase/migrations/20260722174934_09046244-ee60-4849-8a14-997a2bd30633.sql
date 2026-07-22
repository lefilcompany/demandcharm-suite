-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Ensure Vault has the cron token (idempotent: only creates if missing)
do $$
declare
  v_existing uuid;
begin
  select id into v_existing from vault.secrets where name = 'check_deadlines_cron_token';
  if v_existing is null then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'check_deadlines_cron_token',
      'Token used by pg_cron to authenticate calls to the check-deadlines edge function'
    );
  end if;
end $$;

-- Security-definer accessor restricted to service_role
create or replace function public.get_check_deadlines_cron_token()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_cron_token' limit 1;
$$;

revoke all on function public.get_check_deadlines_cron_token() from public;
revoke all on function public.get_check_deadlines_cron_token() from anon;
revoke all on function public.get_check_deadlines_cron_token() from authenticated;
grant execute on function public.get_check_deadlines_cron_token() to service_role;

-- Remove any prior job with the same name to avoid duplicates
do $$
begin
  if exists (select 1 from cron.job where jobname = 'check-deadlines-daily') then
    perform cron.unschedule('check-deadlines-daily');
  end if;
end $$;

-- Schedule daily at 12:00 UTC (09:00 America/Recife, no DST)
select cron.schedule(
  'check-deadlines-daily',
  '0 12 * * *',
  $job$
  select net.http_post(
    url := 'https://erxhxmetrvkigjwxchbj.supabase.co/functions/v1/check-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_check_deadlines_cron_token()
    ),
    body := jsonb_build_object('scheduled_at', now())
  );
  $job$
);