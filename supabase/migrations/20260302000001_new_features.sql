-- =============================================================
-- New Features: Stock Counts, Purchase Orders, Notifications,
-- Transactions, Profile extensions
-- =============================================================

-- =============================================================
-- 1A. STOCK_COUNTS
-- =============================================================
CREATE TABLE stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_stock_counts_status ON stock_counts(status);
CREATE INDEX idx_stock_counts_created_by ON stock_counts(created_by);

CREATE TRIGGER trg_stock_counts_updated_at
  BEFORE UPDATE ON stock_counts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- 1B. STOCK_COUNT_ITEMS
-- =============================================================
CREATE TABLE stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  expected_quantity INT NOT NULL DEFAULT 0,
  counted_quantity INT,
  difference INT,
  counted_by UUID,
  counted_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_stock_count_items_sc ON stock_count_items(stock_count_id);
CREATE INDEX idx_stock_count_items_item ON stock_count_items(item_id);

-- =============================================================
-- 1C. PURCHASE_ORDERS
-- =============================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  order_date TIMESTAMPTZ DEFAULT now(),
  expected_date TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(po_number);

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- 1D. PURCHASE_ORDER_ITEMS
-- =============================================================
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity_ordered INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  received_at TIMESTAMPTZ,
  received_by UUID
);

CREATE INDEX idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX idx_po_items_item ON purchase_order_items(item_id);

-- =============================================================
-- 1E. NOTIFICATIONS
-- =============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  related_item_id UUID,
  related_pick_list_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =============================================================
-- 1F. TRANSACTIONS
-- =============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL,
  quantity_before INT NOT NULL DEFAULT 0,
  quantity_after INT NOT NULL DEFAULT 0,
  quantity_change INT NOT NULL DEFAULT 0,
  reference_id UUID,
  reference_type TEXT,
  performed_by UUID,
  notes TEXT,
  folder_name TEXT,
  item_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_performed_by ON transactions(performed_by);

-- =============================================================
-- 1G. UPDATE PROFILES
-- =============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"role":"member"}'::jsonb;

-- =============================================================
-- ROW LEVEL SECURITY for new tables
-- =============================================================
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Stock Counts
CREATE POLICY "Authenticated users can view stock_counts"
  ON stock_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_counts"
  ON stock_counts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_counts"
  ON stock_counts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete stock_counts"
  ON stock_counts FOR DELETE TO authenticated USING (true);

-- Stock Count Items
CREATE POLICY "Authenticated users can view stock_count_items"
  ON stock_count_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stock_count_items"
  ON stock_count_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stock_count_items"
  ON stock_count_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete stock_count_items"
  ON stock_count_items FOR DELETE TO authenticated USING (true);

-- Purchase Orders
CREATE POLICY "Authenticated users can view purchase_orders"
  ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert purchase_orders"
  ON purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update purchase_orders"
  ON purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete purchase_orders"
  ON purchase_orders FOR DELETE TO authenticated USING (true);

-- Purchase Order Items
CREATE POLICY "Authenticated users can view purchase_order_items"
  ON purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert purchase_order_items"
  ON purchase_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update purchase_order_items"
  ON purchase_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete purchase_order_items"
  ON purchase_order_items FOR DELETE TO authenticated USING (true);

-- Notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Transactions
CREATE POLICY "Authenticated users can view transactions"
  ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert transactions"
  ON transactions FOR INSERT TO authenticated WITH CHECK (true);
