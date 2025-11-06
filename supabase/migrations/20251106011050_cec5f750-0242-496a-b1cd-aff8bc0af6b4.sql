-- Helper function to fetch a user's first- and second-degree network friendships
CREATE OR REPLACE FUNCTION public.get_network_friendships(p_user_id uuid)
RETURNS SETOF public.friendships
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requester uuid := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
BEGIN
  -- Ensure the caller is only requesting their own network
  IF requester IS NULL OR requester <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH my_friends AS (
    SELECT CASE WHEN f.user_id = p_user_id THEN f.friend_id ELSE f.user_id END AS uid
    FROM public.friendships f
    WHERE f.user_id = p_user_id OR f.friend_id = p_user_id
  ),
  fof AS (
    -- friends of my friends (second-degree)
    SELECT DISTINCT CASE WHEN f.user_id = mf.uid THEN f.friend_id ELSE f.user_id END AS uid
    FROM public.friendships f
    JOIN my_friends mf ON (f.user_id = mf.uid OR f.friend_id = mf.uid)
  ),
  network AS (
    SELECT p_user_id AS uid
    UNION SELECT uid FROM my_friends
    UNION SELECT uid FROM fof
  )
  SELECT f.*
  FROM public.friendships f
  WHERE f.user_id IN (SELECT uid FROM network)
    AND f.friend_id IN (SELECT uid FROM network);
END;
$$;

-- Allow callers to execute the RPC (execution will still be limited by the function guard)
GRANT EXECUTE ON FUNCTION public.get_network_friendships(uuid) TO anon, authenticated;

-- Update DELETE policy so either side can remove a friendship
DROP POLICY IF EXISTS "Users can delete friendships" ON public.friendships;
CREATE POLICY "Users can delete their or their friend's friendships"
ON public.friendships
FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);
