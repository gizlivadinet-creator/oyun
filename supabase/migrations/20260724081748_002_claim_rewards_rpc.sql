/*
# Add claim_rewards RPC

Adds a SECURITY DEFINER function that atomically awards XP and coins to a user
profile, recomputes the derived level, and returns the updated profile row.

This is used by the mission reward claim flow. SECURITY DEFINER is required
because the update runs inside a transaction triggered by authenticated users
and must be able to update the profiles row regardless of the caller's RLS
context on the XP/coins columns (the update policy already allows self-updates,
but the RPC keeps it atomic and recomputes level server-side).

## New Functions
- claim_rewards(uid uuid, xp_amount int, coin_amount int) → profiles row

## Security
- SECURITY DEFINER, owned by postgres.
- Only updates the profile matching the supplied uid.
- Level recomputed with the same formula as bump_xp: 1 + floor(sqrt(xp)/20).
*/

CREATE OR REPLACE FUNCTION claim_rewards(uid uuid, xp_amount int, coin_amount int)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated profiles;
BEGIN
  UPDATE profiles
  SET
    xp = xp + xp_amount,
    coins = coins + coin_amount,
    level = GREATEST(1, 1 + FLOOR(SQRT(GREATEST(xp + xp_amount, 0)) / 20)::int),
    updated_at = now()
  WHERE id = uid
  RETURNING * INTO updated;
  RETURN updated;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_rewards(uuid, int, int) TO authenticated;
