CREATE TABLE IF NOT EXISTS public._availability_test_results (name text, passed boolean, detail text);
ALTER TABLE public._availability_test_results ENABLE ROW LEVEL SECURITY;
TRUNCATE public._availability_test_results;
INSERT INTO public._availability_test_results SELECT * FROM public._availability_selftest();