-- ============================================================
-- 008_quantity_numeric.sql
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- 수량 소수점 지원 (0.5kg, 1.5L 등) — INT → NUMERIC(8,2)
-- (멱등 — 여러 번 실행해도 안전)
-- ============================================================

ALTER TABLE items
  ALTER COLUMN quantity TYPE NUMERIC(8,2) USING quantity::numeric;

ALTER TABLE shopping_items
  ALTER COLUMN quantity TYPE NUMERIC(8,2) USING quantity::numeric;
