-- Allow users without a team to create and see their own data.
-- team_id = NULL means personal/unassigned data, scoped by created_by.

-- ============================================================
-- 1. Make team_id nullable on all data tables
-- ============================================================

ALTER TABLE folders ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE items ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE tags ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE item_tags ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE pick_lists ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE pick_list_items ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE activity_log ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE pick_list_comments ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE stock_counts ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN team_id DROP NOT NULL;

-- ============================================================
-- 2. Add created_by to tables that lack it
-- ============================================================

ALTER TABLE folders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Backfill created_by on folders/tags from first profile
DO $$
DECLARE
  v_first_user UUID;
BEGIN
  SELECT id INTO v_first_user FROM profiles ORDER BY created_at LIMIT 1;
  IF v_first_user IS NOT NULL THEN
    UPDATE folders SET created_by = v_first_user WHERE created_by IS NULL;
    UPDATE tags SET created_by = v_first_user WHERE created_by IS NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Replace RLS policies to support personal data
-- ============================================================

-- Helper: checks if a row is personal data owned by the current user
-- Pattern: (team_id IS NULL AND created_by = auth.uid())

-- FOLDERS
DROP POLICY IF EXISTS "Team members can view folders" ON folders;
DROP POLICY IF EXISTS "Team members can create folders" ON folders;
DROP POLICY IF EXISTS "Team members can update folders" ON folders;
DROP POLICY IF EXISTS "Team members can delete folders" ON folders;

CREATE POLICY "Users can view folders" ON folders FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can create folders" ON folders FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can update folders" ON folders FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can delete folders" ON folders FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));

-- ITEMS
DROP POLICY IF EXISTS "Team members can view items" ON items;
DROP POLICY IF EXISTS "Team members can create items" ON items;
DROP POLICY IF EXISTS "Team members can update items" ON items;
DROP POLICY IF EXISTS "Team members can delete items" ON items;

CREATE POLICY "Users can view items" ON items FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can create items" ON items FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can update items" ON items FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can delete items" ON items FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));

-- TAGS
DROP POLICY IF EXISTS "Team members can view tags" ON tags;
DROP POLICY IF EXISTS "Team members can create tags" ON tags;
DROP POLICY IF EXISTS "Team members can update tags" ON tags;
DROP POLICY IF EXISTS "Team members can delete tags" ON tags;

CREATE POLICY "Users can view tags" ON tags FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can create tags" ON tags FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can update tags" ON tags FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can delete tags" ON tags FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));

-- ITEM_TAGS (scope via parent item ownership)
DROP POLICY IF EXISTS "Team members can view item_tags" ON item_tags;
DROP POLICY IF EXISTS "Team members can create item_tags" ON item_tags;
DROP POLICY IF EXISTS "Team members can delete item_tags" ON item_tags;

CREATE POLICY "Users can view item_tags" ON item_tags FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND item_id IN (SELECT id FROM items WHERE created_by = auth.uid())));
CREATE POLICY "Users can create item_tags" ON item_tags FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND item_id IN (SELECT id FROM items WHERE created_by = auth.uid())));
CREATE POLICY "Users can delete item_tags" ON item_tags FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND item_id IN (SELECT id FROM items WHERE created_by = auth.uid())));

-- PICK_LISTS
DROP POLICY IF EXISTS "Team members can view pick_lists" ON pick_lists;
DROP POLICY IF EXISTS "Team members can create pick_lists" ON pick_lists;
DROP POLICY IF EXISTS "Team members can update pick_lists" ON pick_lists;
DROP POLICY IF EXISTS "Team members can delete pick_lists" ON pick_lists;

CREATE POLICY "Users can view pick_lists" ON pick_lists FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can create pick_lists" ON pick_lists FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can update pick_lists" ON pick_lists FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can delete pick_lists" ON pick_lists FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));

-- PICK_LIST_ITEMS (scope via parent pick_list)
DROP POLICY IF EXISTS "Team members can view pick_list_items" ON pick_list_items;
DROP POLICY IF EXISTS "Team members can create pick_list_items" ON pick_list_items;
DROP POLICY IF EXISTS "Team members can update pick_list_items" ON pick_list_items;
DROP POLICY IF EXISTS "Team members can delete pick_list_items" ON pick_list_items;

CREATE POLICY "Users can view pick_list_items" ON pick_list_items FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND pick_list_id IN (SELECT id FROM pick_lists WHERE created_by = auth.uid())));
CREATE POLICY "Users can create pick_list_items" ON pick_list_items FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND pick_list_id IN (SELECT id FROM pick_lists WHERE created_by = auth.uid())));
CREATE POLICY "Users can update pick_list_items" ON pick_list_items FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND pick_list_id IN (SELECT id FROM pick_lists WHERE created_by = auth.uid())));
CREATE POLICY "Users can delete pick_list_items" ON pick_list_items FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND pick_list_id IN (SELECT id FROM pick_lists WHERE created_by = auth.uid())));

-- ACTIVITY_LOG
DROP POLICY IF EXISTS "Team members can view activity_log" ON activity_log;
DROP POLICY IF EXISTS "Team members can create activity_log" ON activity_log;

CREATE POLICY "Users can view activity_log" ON activity_log FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND user_id = auth.uid()));
CREATE POLICY "Users can create activity_log" ON activity_log FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND user_id = auth.uid()));

-- PICK_LIST_COMMENTS
DROP POLICY IF EXISTS "Team members can view pick_list_comments" ON pick_list_comments;
DROP POLICY IF EXISTS "Team members can create pick_list_comments" ON pick_list_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON pick_list_comments;

CREATE POLICY "Users can view pick_list_comments" ON pick_list_comments FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND user_id = auth.uid()));
CREATE POLICY "Users can create pick_list_comments" ON pick_list_comments FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND user_id = auth.uid()));
CREATE POLICY "Users can delete own comments" ON pick_list_comments FOR DELETE
  USING (user_id = auth.uid());

-- STOCK_COUNTS
DROP POLICY IF EXISTS "Team members can view stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Team members can create stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Team members can update stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Team members can delete stock_counts" ON stock_counts;

CREATE POLICY "Users can view stock_counts" ON stock_counts FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can create stock_counts" ON stock_counts FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can update stock_counts" ON stock_counts FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can delete stock_counts" ON stock_counts FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));

-- PURCHASE_ORDERS
DROP POLICY IF EXISTS "Team members can view purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Team members can create purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Team members can update purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Team members can delete purchase_orders" ON purchase_orders;

CREATE POLICY "Users can view purchase_orders" ON purchase_orders FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can create purchase_orders" ON purchase_orders FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can update purchase_orders" ON purchase_orders FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "Users can delete purchase_orders" ON purchase_orders FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND created_by = auth.uid()));

-- TRANSACTIONS
DROP POLICY IF EXISTS "Team members can view transactions" ON transactions;
DROP POLICY IF EXISTS "Team members can create transactions" ON transactions;

CREATE POLICY "Users can view transactions" ON transactions FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND performed_by = auth.uid()));
CREATE POLICY "Users can create transactions" ON transactions FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()) OR (team_id IS NULL AND performed_by = auth.uid()));
