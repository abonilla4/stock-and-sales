-- ============================================================
-- Migración 00021: Fix de privilegios de UPDATE en columnas críticas
-- En PostgreSQL, para restringir UPDATE a nivel de columna cuando
-- previamente existe UPDATE a nivel de tabla, se debe revocar el UPDATE
-- general de la tabla y otorgar UPDATE exclusivamente en las columnas permitidas.
-- ============================================================

-- 1. Revocar UPDATE general a nivel de tabla en productos y clientes
REVOKE UPDATE ON public.productos FROM authenticated, anon, public;
REVOKE UPDATE ON public.clientes FROM authenticated, anon, public;

-- 2. Otorgar UPDATE únicamente en las columnas editables de productos (excluyendo stock_actual)
GRANT UPDATE (
  sku,
  codigo_barras,
  nombre,
  descripcion,
  categoria_id,
  proveedor_id,
  unidad_medida,
  precio_costo_usd,
  precio_venta_usd,
  stock_minimo,
  activo,
  updated_at
) ON public.productos TO authenticated;

-- 3. Otorgar UPDATE únicamente en las columnas editables de clientes (excluyendo saldo_fiado)
GRANT UPDATE (
  nombre,
  telefono,
  identificacion,
  notas,
  updated_at
) ON public.clientes TO authenticated;

NOTIFY pgrst, 'reload schema';
