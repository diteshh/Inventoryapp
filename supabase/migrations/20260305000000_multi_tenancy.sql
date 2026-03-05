-- Multi-tenancy migration: teams, team_members, team_invites
-- Adds team_id to all data tables + RLS enforcement

-- ============================================================
-- 1. NEW TABLES
-- ============================================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  used_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_invites_code ON team_invites(invite_code);

-- ============================================================
-- 2. ADD team_id TO EXISTING DATA TABLES
-- ============================================================

ALTER TABLE folders ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE items ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE tags ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE item_tags ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE pick_lists ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE pick_list_items ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE activity_log ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE pick_list_comments ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE stock_counts ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE purchase_orders ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE transactions ADD COLUMN team_id UUID REFERENCES teams(id);

-- Indexes on team_id
CREATE INDEX idx_folders_team_id ON folders(team_id);
CREATE INDEX idx_items_team_id ON items(team_id);
CREATE INDEX idx_tags_team_id ON tags(team_id);
CREATE INDEX idx_pick_lists_team_id ON pick_lists(team_id);
CREATE INDEX idx_activity_log_team_id ON activity_log(team_id);
CREATE INDEX idx_stock_counts_team_id ON stock_counts(team_id);
CREATE INDEX idx_purchase_orders_team_id ON purchase_orders(team_id);
CREATE INDEX idx_transactions_team_id ON transactions(team_id);

-- ============================================================
-- 3. DATA MIGRATION — backfill existing rows
-- ============================================================

-- Create a default team from the first owner user (or first user if no owner)
DO $$
DECLARE
  v_team_id UUID;
  v_owner_id UUID;
BEGIN
  -- Find owner or first user
  SELECT id INTO v_owner_id FROM profiles WHERE role = 'owner' LIMIT 1;
  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM profiles ORDER BY created_at LIMIT 1;
  END IF;

  -- Only proceed if there are existing users
  IF v_owner_id IS NOT NULL THEN
    v_team_id := gen_random_uuid();

    INSERT INTO teams (id, name, created_by) VALUES (v_team_id, 'My Team', v_owner_id);

    -- Add all existing users to the default team, preserving their roles
    INSERT INTO team_members (team_id, user_id, role)
    SELECT v_team_id, p.id, COALESCE(p.role, 'member')
    FROM profiles p;

    -- Backfill team_id on all data tables
    UPDATE folders SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE items SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE tags SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE item_tags SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE pick_lists SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE pick_list_items SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE activity_log SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE pick_list_comments SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE stock_counts SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE purchase_orders SET team_id = v_team_id WHERE team_id IS NULL;
    UPDATE transactions SET team_id = v_team_id WHERE team_id IS NULL;
  END IF;
END $$;

-- ============================================================
-- 4. ADD NOT NULL CONSTRAINTS (after backfill)
-- ============================================================

ALTER TABLE folders ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE items ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE tags ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE item_tags ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE pick_lists ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE pick_list_items ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE activity_log ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE pick_list_comments ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE stock_counts ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN team_id SET NOT NULL;

-- ============================================================
-- 5. RLS HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Teams: users can see teams they belong to
CREATE POLICY "Users can view own teams" ON teams FOR SELECT
  USING (id IN (SELECT get_user_team_ids()));
CREATE POLICY "Authenticated users can create teams" ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Team owners can update team" ON teams FOR UPDATE
  USING (id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'owner'));

-- Team members: users can see members of their teams
CREATE POLICY "Users can view team members" ON team_members FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Users can insert team members" ON team_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update team members" ON team_members FOR UPDATE
  USING (team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
CREATE POLICY "Admins can delete team members" ON team_members FOR DELETE
  USING (team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));

-- Team invites: users can see invites for their teams
CREATE POLICY "Users can view team invites" ON team_invites FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Admins can create invites" ON team_invites FOR INSERT
  WITH CHECK (team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('owner','admin')));
-- Anyone authenticated can read an invite by code (for joining)
CREATE POLICY "Anyone can read invite by code" ON team_invites FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Invite can be updated on use" ON team_invites FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 7. REPLACE EXISTING RLS POLICIES WITH TEAM-SCOPED ONES
-- ============================================================

-- FOLDERS
DROP POLICY IF EXISTS "Authenticated users can view folders" ON folders;
DROP POLICY IF EXISTS "Authenticated users can create folders" ON folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON folders;

CREATE POLICY "Team members can view folders" ON folders FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create folders" ON folders FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update folders" ON folders FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete folders" ON folders FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- ITEMS
DROP POLICY IF EXISTS "Authenticated users can view items" ON items;
DROP POLICY IF EXISTS "Authenticated users can create items" ON items;
DROP POLICY IF EXISTS "Authenticated users can update items" ON items;
DROP POLICY IF EXISTS "Authenticated users can delete items" ON items;

CREATE POLICY "Team members can view items" ON items FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create items" ON items FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update items" ON items FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete items" ON items FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- TAGS
DROP POLICY IF EXISTS "Authenticated users can view tags" ON tags;
DROP POLICY IF EXISTS "Authenticated users can create tags" ON tags;
DROP POLICY IF EXISTS "Authenticated users can update tags" ON tags;
DROP POLICY IF EXISTS "Authenticated users can delete tags" ON tags;

CREATE POLICY "Team members can view tags" ON tags FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create tags" ON tags FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update tags" ON tags FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete tags" ON tags FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- ITEM_TAGS
DROP POLICY IF EXISTS "Authenticated users can view item_tags" ON item_tags;
DROP POLICY IF EXISTS "Authenticated users can create item_tags" ON item_tags;
DROP POLICY IF EXISTS "Authenticated users can delete item_tags" ON item_tags;

CREATE POLICY "Team members can view item_tags" ON item_tags FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create item_tags" ON item_tags FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete item_tags" ON item_tags FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- PICK_LISTS
DROP POLICY IF EXISTS "Authenticated users can view pick_lists" ON pick_lists;
DROP POLICY IF EXISTS "Authenticated users can create pick_lists" ON pick_lists;
DROP POLICY IF EXISTS "Authenticated users can update pick_lists" ON pick_lists;
DROP POLICY IF EXISTS "Authenticated users can delete pick_lists" ON pick_lists;

CREATE POLICY "Team members can view pick_lists" ON pick_lists FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create pick_lists" ON pick_lists FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update pick_lists" ON pick_lists FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete pick_lists" ON pick_lists FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- PICK_LIST_ITEMS
DROP POLICY IF EXISTS "Authenticated users can view pick_list_items" ON pick_list_items;
DROP POLICY IF EXISTS "Authenticated users can create pick_list_items" ON pick_list_items;
DROP POLICY IF EXISTS "Authenticated users can update pick_list_items" ON pick_list_items;
DROP POLICY IF EXISTS "Authenticated users can delete pick_list_items" ON pick_list_items;

CREATE POLICY "Team members can view pick_list_items" ON pick_list_items FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create pick_list_items" ON pick_list_items FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update pick_list_items" ON pick_list_items FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete pick_list_items" ON pick_list_items FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- ACTIVITY_LOG
DROP POLICY IF EXISTS "Authenticated users can view activity_log" ON activity_log;
DROP POLICY IF EXISTS "Authenticated users can create activity_log" ON activity_log;

CREATE POLICY "Team members can view activity_log" ON activity_log FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create activity_log" ON activity_log FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));

-- PICK_LIST_COMMENTS
DROP POLICY IF EXISTS "Authenticated users can view pick_list_comments" ON pick_list_comments;
DROP POLICY IF EXISTS "Authenticated users can create pick_list_comments" ON pick_list_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON pick_list_comments;

CREATE POLICY "Team members can view pick_list_comments" ON pick_list_comments FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create pick_list_comments" ON pick_list_comments FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Users can delete own comments" ON pick_list_comments FOR DELETE
  USING (user_id = auth.uid() AND team_id IN (SELECT get_user_team_ids()));

-- STOCK_COUNTS
DROP POLICY IF EXISTS "Authenticated users can view stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Authenticated users can create stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Authenticated users can update stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Authenticated users can delete stock_counts" ON stock_counts;

CREATE POLICY "Team members can view stock_counts" ON stock_counts FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create stock_counts" ON stock_counts FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update stock_counts" ON stock_counts FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete stock_counts" ON stock_counts FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- PURCHASE_ORDERS
DROP POLICY IF EXISTS "Authenticated users can view purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can create purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can update purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can delete purchase_orders" ON purchase_orders;

CREATE POLICY "Team members can view purchase_orders" ON purchase_orders FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create purchase_orders" ON purchase_orders FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can update purchase_orders" ON purchase_orders FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can delete purchase_orders" ON purchase_orders FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- TRANSACTIONS
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON transactions;

CREATE POLICY "Team members can view transactions" ON transactions FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));
CREATE POLICY "Team members can create transactions" ON transactions FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));

-- ============================================================
-- 8. UPDATE VIEWS to be team-aware
-- ============================================================

-- Recreate folder_stats view (RLS on underlying tables handles filtering)
DROP VIEW IF EXISTS folder_stats;
CREATE VIEW folder_stats AS
SELECT
  f.id AS folder_id,
  f.team_id,
  (SELECT COUNT(*) FROM folders sub WHERE sub.parent_folder_id = f.id) AS subfolder_count,
  COALESCE(SUM(i.quantity), 0) AS unit_count,
  COALESCE(SUM(i.quantity * COALESCE(i.sell_price, i.cost_price, 0)), 0) AS total_value
FROM folders f
LEFT JOIN items i ON i.folder_id = f.id AND i.status = 'active'
GROUP BY f.id, f.team_id;

-- Recreate folder_thumbnails view
DROP VIEW IF EXISTS folder_thumbnails;
CREATE VIEW folder_thumbnails AS
SELECT
  f.id AS folder_id,
  f.team_id,
  COALESCE(
    (SELECT ARRAY_AGG(photo) FROM (
      SELECT UNNEST(i.photos) AS photo
      FROM items i
      WHERE i.folder_id = f.id AND i.status = 'active' AND i.photos IS NOT NULL AND ARRAY_LENGTH(i.photos, 1) > 0
      LIMIT 4
    ) sub),
    ARRAY[]::TEXT[]
  ) AS thumbnails
FROM folders f;
