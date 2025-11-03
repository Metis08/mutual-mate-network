-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;

-- Create a new policy that allows users to insert friendships where they are either user_id or friend_id
CREATE POLICY "Users can create friendships" 
ON public.friendships
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);