-- Add FK from pick_lists.assigned_to to profiles.id for PostgREST join
ALTER TABLE pick_lists
  ADD CONSTRAINT pick_lists_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(id);
