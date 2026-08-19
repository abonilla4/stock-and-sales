-- ============================================================
-- Migración 00019: Revocación de privilegios rol anon (Bloque 2 Remediation)
-- 1. REVOKE ALL ON ALL TABLES & SEQUENCES IN SCHEMA public FROM anon.
-- 2. REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public.
-- 3. GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role.
-- 4. ALTER DEFAULT PRIVILEGES para blindar futuras tablas y funciones creadas.
-- ============================================================

-- 1. Primer REVOKE: Revocar acceso a todas las tablas y secuencias para el rol anónimo (anon)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- 2. Segundo REVOKE: Revocar ejecución de todas las funciones para roles anon y public
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;

-- 3. Otorgar permisos explícitos de ejecución a usuarios autenticados y service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 4. Blindar privilegios por defecto para nuevos objetos creados en el esquema public
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
