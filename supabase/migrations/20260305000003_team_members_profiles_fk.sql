-- Add foreign key from team_members.user_id to profiles.id
-- so PostgREST can join team_members with profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
