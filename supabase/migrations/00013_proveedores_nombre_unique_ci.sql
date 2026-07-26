-- ============================================================
-- Migración 00013: Índice único case-insensitive en proveedores.nombre
-- ============================================================

-- 1. Reasignar productos de proveedores duplicados al proveedor principal (el primero creado)
WITH proveedores_rank AS (
  SELECT id,
         lower(nombre) as nombre_ci,
         FIRST_VALUE(id) OVER (
           PARTITION BY lower(nombre)
           ORDER BY created_at ASC
         ) as id_principal
    FROM public.proveedores
)
UPDATE public.productos p
   SET proveedor_id = r.id_principal
  FROM proveedores_rank r
 WHERE p.proveedor_id = r.id
   AND r.id <> r.id_principal;

-- 2. Eliminar registros de proveedores duplicados
WITH proveedores_rank AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY lower(nombre)
           ORDER BY created_at ASC
         ) as id_principal
    FROM public.proveedores
)
DELETE FROM public.proveedores
 WHERE id IN (
   SELECT id FROM proveedores_rank WHERE id <> id_principal
 );

-- 3. Crear el índice único case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nombre_unique_ci
  ON public.proveedores (lower(nombre));
