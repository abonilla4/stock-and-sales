-- ============================================================
-- Migración 00025: Funciones de verificación de permisos
--
-- Estas funciones son la base de las políticas RLS que se reescriben
-- en la migración 00028. Son SECURITY DEFINER para poder leer profiles
-- y rol_permisos sin quedar atrapadas en las propias políticas RLS de
-- esas tablas (evita recursión infinita en las policies).
--
-- ⚠️  USO EN POLÍTICAS RLS — RENDIMIENTO
--     Siempre envolver en subconsulta para que PostgreSQL la evalúe UNA
--     vez por sentencia (InitPlan) y no una vez por fila:
--
--       USING ( (SELECT public.tiene_permiso('productos.editar')) )   ✅
--       USING ( public.tiene_permiso('productos.editar') )            ❌
--
--     Sin el SELECT envolvente, listar 2.000 productos ejecuta la
--     función 2.000 veces.
-- ============================================================

-- =========================
-- 1. tiene_permiso — usuario en sesión
-- =========================

CREATE OR REPLACE FUNCTION public.tiene_permiso(p_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
      JOIN public.rol_permisos rp ON rp.rol = pr.role
     WHERE pr.id = (SELECT auth.uid())
       AND rp.permiso_codigo = p_codigo
  );
$$;

COMMENT ON FUNCTION public.tiene_permiso(text) IS
  'Verifica si el usuario en sesión tiene el permiso indicado. En políticas RLS usar siempre envuelta: (SELECT tiene_permiso(...)).';

-- =========================
-- 2. tiene_permiso_para — usuario arbitrario
-- =========================
-- Necesaria para la autorización delegada: el administrador que autoriza
-- NO es auth.uid() (ese es el cajero que solicita).

CREATE OR REPLACE FUNCTION public.tiene_permiso_para(
  p_usuario_id uuid,
  p_codigo     text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
      JOIN public.rol_permisos rp ON rp.rol = pr.role
     WHERE pr.id = p_usuario_id
       AND rp.permiso_codigo = p_codigo
  );
$$;

COMMENT ON FUNCTION public.tiene_permiso_para(uuid, text) IS
  'Verifica permisos de un usuario específico. Usada en el flujo de autorización delegada, donde el autorizador no es el usuario en sesión.';

-- =========================
-- 3. Helpers de rol
-- =========================

CREATE OR REPLACE FUNCTION public.es_desarrollador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (SELECT auth.uid())
       AND role = 'desarrollador'
  );
$$;

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (SELECT auth.uid())
       AND role IN ('admin', 'desarrollador')
  );
$$;

COMMENT ON FUNCTION public.es_admin() IS
  'True si el usuario en sesión es admin o desarrollador. El desarrollador siempre supera al admin.';

-- =========================
-- 4. mis_permisos — para la UI
-- =========================
-- Permite al frontend pedir de una sola vez todos los permisos del usuario
-- y evitar N llamadas a tiene_permiso() al renderizar el menú.

CREATE OR REPLACE FUNCTION public.mis_permisos()
RETURNS TABLE (permiso_codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rp.permiso_codigo
    FROM public.profiles pr
    JOIN public.rol_permisos rp ON rp.rol = pr.role
   WHERE pr.id = (SELECT auth.uid());
$$;

-- =========================
-- 5. Privilegios de ejecución
-- =========================

REVOKE EXECUTE ON FUNCTION public.tiene_permiso(text)             FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tiene_permiso_para(uuid, text)  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.es_desarrollador()              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.es_admin()                      FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mis_permisos()                  FROM anon, public;

GRANT EXECUTE ON FUNCTION public.tiene_permiso(text)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tiene_permiso_para(uuid, text)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.es_desarrollador()               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.es_admin()                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mis_permisos()                   TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
