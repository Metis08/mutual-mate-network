-- Fix get_network_friendships to use auth.uid() for requester detection
CREATE OR REPLACE FUNCTION public.get_network_friendships(p_user_id uuid)
RETURNS SETOF friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requester uuid := auth.uid();
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
$function$;