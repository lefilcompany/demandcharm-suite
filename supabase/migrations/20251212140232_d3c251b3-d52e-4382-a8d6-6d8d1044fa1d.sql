-- Drop the overly permissive INSERT policy that allows anyone to create notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;