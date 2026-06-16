-- Drop the existing policy that checks team membership
DROP POLICY IF EXISTS "Team members can view team boards" ON public.boards;

-- Create new policy that checks board membership
CREATE POLICY "Board members can view their boards" 
ON public.boards 
FOR SELECT 
USING (id IN (SELECT get_user_board_ids(auth.uid())));

-- Also need to update demands table to check board membership for viewing
DROP POLICY IF EXISTS "Team members can view demands" ON public.demands;

CREATE POLICY "Board members can view demands" 
ON public.demands 
FOR SELECT 
USING (board_id IN (SELECT get_user_board_ids(auth.uid())));

-- Update demands insert policy
DROP POLICY IF EXISTS "Team members can create demands" ON public.demands;

CREATE POLICY "Board members can create demands" 
ON public.demands 
FOR INSERT 
WITH CHECK (board_id IN (SELECT get_user_board_ids(auth.uid())));

-- Update demands update policy  
DROP POLICY IF EXISTS "Team members can update demands" ON public.demands;

CREATE POLICY "Board members can update demands" 
ON public.demands 
FOR UPDATE 
USING (board_id IN (SELECT get_user_board_ids(auth.uid())));