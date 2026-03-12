-- Pick list issues table for reporting problems during guided picking
CREATE TABLE IF NOT EXISTS pick_list_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id uuid NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  pick_list_item_id uuid NOT NULL REFERENCES pick_list_items(id) ON DELETE CASCADE,
  issue_type text NOT NULL CHECK (issue_type IN ('damaged_stock', 'missing_unit', 'wrong_stock_at_location', 'barcode_mismatch', 'other')),
  quantity_affected int NOT NULL DEFAULT 0,
  quantity_actually_picked int NOT NULL DEFAULT 0,
  notes text,
  reported_by uuid REFERENCES auth.users(id),
  team_id uuid REFERENCES teams(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pick_list_issues_pick_list_id ON pick_list_issues(pick_list_id);
CREATE INDEX idx_pick_list_issues_pick_list_item_id ON pick_list_issues(pick_list_item_id);
CREATE INDEX idx_pick_list_issues_team_id ON pick_list_issues(team_id);

-- updated_at trigger (reuse existing function)
CREATE TRIGGER set_pick_list_issues_updated_at
  BEFORE UPDATE ON pick_list_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE pick_list_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pick list issues for their team or personal data"
  ON pick_list_issues FOR SELECT USING (
    team_id IN (SELECT get_user_team_ids())
    OR (team_id IS NULL AND reported_by = auth.uid())
  );

CREATE POLICY "Users can insert pick list issues for their team or personal data"
  ON pick_list_issues FOR INSERT WITH CHECK (
    team_id IN (SELECT get_user_team_ids())
    OR (team_id IS NULL AND reported_by = auth.uid())
  );

CREATE POLICY "Users can update their own pick list issues"
  ON pick_list_issues FOR UPDATE USING (
    reported_by = auth.uid()
  );

CREATE POLICY "Users can delete their own pick list issues"
  ON pick_list_issues FOR DELETE USING (
    reported_by = auth.uid()
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pick_list_issues;
