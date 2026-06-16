-- Add foreign key from board_members to profiles for the join to work
ALTER TABLE public.board_members 
ADD CONSTRAINT board_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also add foreign key for added_by
ALTER TABLE public.board_members 
ADD CONSTRAINT board_members_added_by_fkey 
FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;