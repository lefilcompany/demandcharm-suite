-- Fix demand-attachments storage security: make bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'demand-attachments';

-- Remove the public SELECT policy for attachments
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;

-- Create proper RLS policy for viewing attachments (team members only)
CREATE POLICY "Team members can view demand attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'demand-attachments' AND
  EXISTS (
    SELECT 1 
    FROM public.demand_attachments da
    JOIN public.demands d ON d.id = da.demand_id
    WHERE da.file_path = name
    AND d.team_id IN (SELECT public.get_user_team_ids(auth.uid()))
  )
);

-- Fix notify_mention function to use parameterized query and prevent SQL injection
CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_user_id UUID;
  mention_pattern TEXT;
  demand_title TEXT;
  sanitized_pattern TEXT;
BEGIN
  -- Get demand title
  SELECT title INTO demand_title FROM demands WHERE id = NEW.demand_id;
  
  -- Find all @mentions in content using regex
  FOR mention_pattern IN 
    SELECT (regexp_matches(NEW.content, '@([a-zA-Z0-9_-]+)', 'g'))[1]
  LOOP
    -- Sanitize the pattern: only allow alphanumeric, underscore, and hyphen
    sanitized_pattern := regexp_replace(mention_pattern, '[^a-zA-Z0-9_-]', '', 'g');
    
    -- Skip if pattern is empty after sanitization
    IF length(sanitized_pattern) = 0 THEN
      CONTINUE;
    END IF;
    
    -- Find user by exact name match (case insensitive) using parameterized approach
    SELECT id INTO mentioned_user_id 
    FROM profiles 
    WHERE LOWER(full_name) = LOWER(sanitized_pattern)
    LIMIT 1;
    
    -- If exact match not found, try partial match with proper escaping
    IF mentioned_user_id IS NULL THEN
      SELECT id INTO mentioned_user_id 
      FROM profiles 
      WHERE full_name ILIKE '%' || replace(replace(sanitized_pattern, '%', '\%'), '_', '\_') || '%'
      LIMIT 1;
    END IF;
    
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        mentioned_user_id,
        'Você foi mencionado',
        'Você foi mencionado em um comentário na demanda "' || left(demand_title, 100) || '"',
        'info',
        '/demands/' || NEW.demand_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;