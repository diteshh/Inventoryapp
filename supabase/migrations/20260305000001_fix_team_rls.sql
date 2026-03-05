-- Fix team creation RLS: allow users to see teams they created,
-- and allow inserting the first team_member row for a newly created team.

-- Teams: also allow creator to see the team they just created
DROP POLICY IF EXISTS "Users can view own teams" ON teams;
CREATE POLICY "Users can view own teams" ON teams FOR SELECT
  USING (
    id IN (SELECT get_user_team_ids())
    OR created_by = auth.uid()
  );

-- Team members: allow a user to add themselves to a team they just created
DROP POLICY IF EXISTS "Users can insert team members" ON team_members;
CREATE POLICY "Users can insert team members" ON team_members FOR INSERT
  WITH CHECK (
    -- User is adding themselves
    user_id = auth.uid()
    AND (
      -- Either they created the team (first member / owner)
      EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.created_by = auth.uid())
      -- Or they are already a member of a team (admin inviting)
      OR team_id IN (SELECT get_user_team_ids())
    )
  );
