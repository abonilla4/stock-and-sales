-- ============================================================
-- Migración 00018: Agregar columna codigo a tabla proveedores
-- ============================================================

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS codigo text;

NOTIFY pgrst, 'reload schema';
