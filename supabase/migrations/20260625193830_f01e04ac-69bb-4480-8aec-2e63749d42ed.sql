DO $$ 
DECLARE r RECORD; 
BEGIN
  FOR r IN SELECT proname, oidvectortypes(proargtypes) AS args FROM pg_proc WHERE pronamespace = 'public'::regnamespace LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
  END LOOP;
  FOR r IN SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e' LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END $$;