-- ============================================================
-- Migración 00023: Agregar rol 'desarrollador' al enum rol_usuario
--
-- ⚠️  ESTE ARCHIVO DEBE EJECUTARSE SOLO, SIN MEZCLAR CON OTRAS SENTENCIAS.
--     PostgreSQL no permite USAR un valor de enum recién agregado dentro
--     de la misma transacción en que se agregó. Si esta sentencia se
--     combina con la 00024 (que inserta filas usando 'desarrollador'),
--     la migración falla con:
--       ERROR: unsafe use of new value "desarrollador" of enum type
--
-- Orden resultante del enum (de mayor a menor privilegio):
--     desarrollador < admin < cajero
-- Esto permite ORDER BY role de forma natural en el panel.
-- ============================================================

ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'desarrollador' BEFORE 'admin';

NOTIFY pgrst, 'reload schema';
