-- Drop the overly permissive INSERT policy on items that allows inserting to any team
DROP POLICY IF EXISTS "Authenticated users can insert items" ON items;
