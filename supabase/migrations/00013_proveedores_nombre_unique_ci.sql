-- ============================================================
-- Migración 00013: Índice único case-insensitive en proveedores.nombre
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nombre_unique_ci
  ON public.proveedores (lower(nombre));
