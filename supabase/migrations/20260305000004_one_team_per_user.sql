-- Enforce one team per user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_unique'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT team_members_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
