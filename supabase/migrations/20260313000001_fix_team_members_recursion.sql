-- Fix infinite recursion in team_members UPDATE/DELETE policies
-- The old policies queried team_members from within team_members RLS, causing recursion.
-- Use a SECURITY DEFINER function to bypass RLS when checking admin status.

CREATE OR REPLACE FUNCTION is_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- Recreate UPDATE policy using the function
DROP POLICY IF EXISTS "Admins can update team members" ON team_members;
CREATE POLICY "Admins can update team members" ON team_members
  FOR UPDATE
  USING (is_team_admin(team_id));

-- Recreate DELETE policy using the function
DROP POLICY IF EXISTS "Admins can delete team members" ON team_members;
CREATE POLICY "Admins can delete team members" ON team_members
  FOR DELETE
  USING (is_team_admin(team_id));

-- Also allow users to delete their own membership (leave team)
DROP POLICY IF EXISTS "Users can leave team" ON team_members;
CREATE POLICY "Users can leave team" ON team_members
  FOR DELETE
  USING (user_id = auth.uid());
