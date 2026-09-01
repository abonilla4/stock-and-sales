-- ============================================================
-- Migración 00031: RPC listar_usuarios
--
-- El panel de gestión de usuarios necesita datos que viven en `auth.users`
-- (email, último acceso, estado de baneo). Ese esquema NO se expone por RLS
-- directo y no debe exponerse: la única vía de lectura es esta función, que
-- valida permiso antes de devolver nada.
--
-- Por qué SECURITY DEFINER: `authenticated` no tiene privilegios sobre
-- auth.users. La función corre como su dueño y hace de compuerta estrecha —
-- devuelve solo las seis columnas necesarias, nunca la fila completa (que
-- incluye hashes de contraseña, tokens de recuperación y metadatos).
--
-- Requiere: 00026 (catálogo de permisos) y 00027 (tiene_permiso).
-- ============================================================

CREATE OR REPLACE FUNCTION public.listar_usuarios()
RETURNS TABLE (
  id               uuid,
  email            text,
  role             public.rol_usuario,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  banned_until     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Se valida el permiso configurable, no el rol literal. Hoy equivale a
  -- es_desarrollador(): el kernel de asignar_permiso hace
  -- 'sistema.gestionar_usuarios' exclusivo del desarrollador y prohíbe
  -- retirárselo. Pasar por el permiso mantiene una sola fuente de verdad.
  IF NOT (SELECT public.tiene_permiso('sistema.gestionar_usuarios')) THEN
    RAISE EXCEPTION
      'No autorizado: se requiere el permiso sistema.gestionar_usuarios para listar usuarios.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id,
         u.email::text,
         p.role,
         p.created_at,
         u.last_sign_in_at,
         u.banned_until
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   ORDER BY p.role, u.email;
END;
$$;

COMMENT ON FUNCTION public.listar_usuarios() IS
  'Única vía de lectura de auth.users desde la aplicación. Devuelve solo las columnas del panel, nunca la fila completa.';

REVOKE EXECUTE ON FUNCTION public.listar_usuarios() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.listar_usuarios() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
