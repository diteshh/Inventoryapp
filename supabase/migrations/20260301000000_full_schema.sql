-- =============================================================
-- Imperial Inventory - Full Schema Migration
-- Drops existing Orchids schema and creates the schema
-- matching the frontend's types.ts expectations
-- =============================================================

-- Drop existing tables (only test data, incompatible schema)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS stock_levels CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- =============================================================
-- 1. FOLDERS - Hierarchical storage (nested via parent_folder_id)
-- =============================================================
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  icon TEXT,
  colour TEXT,
  description TEXT,
  sku TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 2. TAGS - Item categorization
-- =============================================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  colour TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 3. ITEMS - Inventory items
-- =============================================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC,
  sell_price NUMERIC,
  weight NUMERIC,
  dimensions JSONB,
  photos TEXT[],
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- =============================================================
-- 4. ITEM_TAGS - Many-to-many items <-> tags
-- =============================================================
CREATE TABLE item_tags (
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

-- =============================================================
-- 5. PICK_LISTS - Warehouse picking workflow
-- =============================================================
CREATE TABLE pick_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  assigned_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- =============================================================
-- 6. PICK_LIST_ITEMS - Items within a pick list
-- =============================================================
CREATE TABLE pick_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity_requested INTEGER NOT NULL DEFAULT 1,
  quantity_picked INTEGER NOT NULL DEFAULT 0,
  location_hint TEXT,
  unit_price NUMERIC,
  picked_at TIMESTAMPTZ,
  picked_by UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 7. PROFILES - User profiles (linked to Supabase Auth)
-- =============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  pin_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 8. ACTIVITY_LOG - Audit trail
-- =============================================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action_type TEXT NOT NULL,
  item_id UUID,
  pick_list_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- 9. PICK_LIST_COMMENTS - Team collaboration
-- =============================================================
CREATE TABLE pick_list_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  user_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX idx_items_folder_id ON items(folder_id);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_created_by ON items(created_by);
CREATE INDEX idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX idx_item_tags_tag ON item_tags(tag_id);
CREATE INDEX idx_pick_lists_status ON pick_lists(status);
CREATE INDEX idx_pick_lists_created_by ON pick_lists(created_by);
CREATE INDEX idx_pick_list_items_pick_list ON pick_list_items(pick_list_id);
CREATE INDEX idx_pick_list_items_item ON pick_list_items(item_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_item ON activity_log(item_id);
CREATE INDEX idx_activity_log_pick_list ON activity_log(pick_list_id);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX idx_pick_list_comments_pick_list ON pick_list_comments(pick_list_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- =============================================================
-- TRIGGER: Auto-update updated_at columns
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pick_lists_updated_at
  BEFORE UPDATE ON pick_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- TRIGGER: Auto-create profile on new auth user
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_list_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything (single-tenant app)
-- Items
CREATE POLICY "Authenticated users can view items"
  ON items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert items"
  ON items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update items"
  ON items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete items"
  ON items FOR DELETE TO authenticated USING (true);

-- Folders
CREATE POLICY "Authenticated users can view folders"
  ON folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert folders"
  ON folders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update folders"
  ON folders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete folders"
  ON folders FOR DELETE TO authenticated USING (true);

-- Tags
CREATE POLICY "Authenticated users can view tags"
  ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tags"
  ON tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tags"
  ON tags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete tags"
  ON tags FOR DELETE TO authenticated USING (true);

-- Item Tags
CREATE POLICY "Authenticated users can view item_tags"
  ON item_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert item_tags"
  ON item_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete item_tags"
  ON item_tags FOR DELETE TO authenticated USING (true);

-- Pick Lists
CREATE POLICY "Authenticated users can view pick_lists"
  ON pick_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pick_lists"
  ON pick_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pick_lists"
  ON pick_lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pick_lists"
  ON pick_lists FOR DELETE TO authenticated USING (true);

-- Pick List Items
CREATE POLICY "Authenticated users can view pick_list_items"
  ON pick_list_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pick_list_items"
  ON pick_list_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pick_list_items"
  ON pick_list_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pick_list_items"
  ON pick_list_items FOR DELETE TO authenticated USING (true);

-- Profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Activity Log
CREATE POLICY "Authenticated users can view activity_log"
  ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity_log"
  ON activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Pick List Comments
CREATE POLICY "Authenticated users can view comments"
  ON pick_list_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert comments"
  ON pick_list_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete own comments"
  ON pick_list_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- STORAGE: Item photos bucket
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-photos');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'item-photos');

CREATE POLICY "Authenticated users can delete photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-photos');
