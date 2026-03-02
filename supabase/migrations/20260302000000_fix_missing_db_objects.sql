-- =============================================================
-- Fix Missing DB Objects
-- Creates folder_stats view, folder_thumbnails view, and pick_item RPC
-- =============================================================

-- 0A. folder_stats view
-- Returns subfolder count, item (unit) count, and total value per folder
CREATE OR REPLACE VIEW folder_stats AS
SELECT
  f.id AS folder_id,
  COALESCE(sf.subfolder_count, 0)::int AS subfolder_count,
  COALESCE(it.unit_count, 0)::int AS unit_count,
  COALESCE(it.total_value, 0)::numeric AS total_value
FROM folders f
LEFT JOIN (
  SELECT parent_folder_id, COUNT(*)::int AS subfolder_count
  FROM folders
  GROUP BY parent_folder_id
) sf ON sf.parent_folder_id = f.id
LEFT JOIN (
  SELECT
    folder_id,
    SUM(quantity)::int AS unit_count,
    SUM(quantity * COALESCE(sell_price, cost_price, 0))::numeric AS total_value
  FROM items
  WHERE status = 'active'
  GROUP BY folder_id
) it ON it.folder_id = f.id;

-- 0B. folder_thumbnails view
-- Returns up to 4 photo URLs from items in each folder
CREATE OR REPLACE VIEW folder_thumbnails AS
SELECT
  f.id AS folder_id,
  COALESCE(
    (SELECT array_agg(photo) FROM (
      SELECT unnest(i.photos) AS photo
      FROM items i
      WHERE i.folder_id = f.id
        AND i.status = 'active'
        AND i.photos IS NOT NULL
        AND array_length(i.photos, 1) > 0
      LIMIT 4
    ) sub),
    ARRAY[]::text[]
  ) AS thumbnails
FROM folders f;

-- 0C. pick_item() RPC function
-- Atomic operation: update pick_list_items, decrement items.quantity
CREATE OR REPLACE FUNCTION pick_item(
  p_pick_list_item_id UUID,
  p_quantity_picked INT,
  p_picked_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id UUID;
  v_current_picked INT;
  v_quantity_requested INT;
  v_actual_pick INT;
BEGIN
  -- Get the pick list item details
  SELECT item_id, quantity_picked, quantity_requested
  INTO v_item_id, v_current_picked, v_quantity_requested
  FROM pick_list_items
  WHERE id = p_pick_list_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick list item not found';
  END IF;

  -- Calculate actual pick amount (don't exceed requested)
  v_actual_pick := LEAST(p_quantity_picked, v_quantity_requested - v_current_picked);

  IF v_actual_pick <= 0 THEN
    RAISE EXCEPTION 'Nothing to pick';
  END IF;

  -- Update pick_list_items
  UPDATE pick_list_items
  SET
    quantity_picked = v_current_picked + v_actual_pick,
    picked_at = now(),
    picked_by = p_picked_by
  WHERE id = p_pick_list_item_id;

  -- Decrement items.quantity
  UPDATE items
  SET quantity = GREATEST(quantity - v_actual_pick, 0)
  WHERE id = v_item_id;
END;
$$;
