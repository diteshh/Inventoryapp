-- Fix team_members INSERT policy to allow joining via invite code
-- The old policy only allowed inserts if the user created the team or was already a member.
-- This adds a third condition: a valid (unused, unexpired) invite exists for that team.

DROP POLICY IF EXISTS "Users can insert team members" ON team_members;

CREATE POLICY "Users can insert team members" ON team_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- User created the team
      EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = team_members.team_id AND t.created_by = auth.uid()
      )
      -- OR user is already in the team (admin adding members)
      OR team_id IN (SELECT get_user_team_ids())
      -- OR a valid invite exists for this team
      OR EXISTS (
        SELECT 1 FROM team_invites ti
        WHERE ti.team_id = team_members.team_id
          AND ti.used_by IS NULL
          AND ti.expires_at > now()
      )
    )
  );
