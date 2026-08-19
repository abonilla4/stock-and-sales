-- ============================================================
-- Migración 00020: Bloqueo de UPDATE directo en columnas críticas (Bloque 2)
-- Revoca permisos de UPDATE a nivel de columna para el rol authenticated
-- en `productos.stock_actual` y `clientes.saldo_fiado`.
-- Garantiza a nivel de motor PostgreSQL que los campos críticos solo
-- puedan modificarse a través de las funciones RPC atómicas SECURITY DEFINER.
-- ============================================================

-- 1. Revocar permiso de UPDATE directo en productos.stock_actual para authenticated
REVOKE UPDATE (stock_actual) ON public.productos FROM authenticated;

-- 2. Revocar permiso de UPDATE directo en clientes.saldo_fiado para authenticated
REVOKE UPDATE (saldo_fiado) ON public.clientes FROM authenticated;

NOTIFY pgrst, 'reload schema';
