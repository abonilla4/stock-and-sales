-- ============================================================
-- Migración 00026: Blindaje de profiles.role + RPCs de asignación
--
-- CIERRA LA BRECHA CRÍTICA detectada en la auditoría:
--   La política "Users can update own profile" permitía UPDATE sobre
--   profiles sin WITH CHECK y sin restricción de columna. Un usuario con
--   rol 'cajero' podía ejecutar:
--       UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
--   y auto-promoverse a administrador.
--
-- Estrategia (mismo patrón que la migración 00021):
--   1. Revocar UPDATE sobre profiles a nivel de tabla.
--   2. No re-otorgar ninguna columna: profiles solo tiene id, role y
--      created_at, y ninguna es editable por el usuario final.
--   3. Los cambios de rol pasan exclusivamente por RPC SECURITY DEFINER
--      con validación de kernel.
-- ============================================================

-- =========================
-- 1. BLINDAR profiles
-- =========================

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

REVOKE UPDATE ON public.profiles FROM authenticated, anon, public;
REVOKE INSERT, DELETE ON public.profiles FROM authenticated, anon, public;

-- El desarrollador necesita ver todos los perfiles para el panel.
DROP POLICY IF EXISTS "Desarrollador can view all profiles" ON public.profiles;
CREATE POLICY "Desarrollador can view all profiles"
  ON public.profiles FOR SELECT
  USING ( (SELECT public.es_desarrollador()) );

-- La política existente "Users can view own profile" se mantiene intacta.

-- =========================
-- 2. RPC asignar_rol
-- =========================

CREATE OR REPLACE FUNCTION public.asignar_rol(
  p_usuario_id uuid,
  p_rol        public.rol_usuario
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id     uuid := (SELECT auth.uid());
  v_rol_actual   public.rol_usuario;
  v_email_target text;
BEGIN
  -- (a) Solo el desarrollador asigna roles.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_actor_id AND role = 'desarrollador'
  ) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol desarrollador para asignar roles.'
      USING ERRCODE = '42501';
  END IF;

  -- (b) Nadie modifica su propio rol. Ni siquiera el desarrollador.
  --     Evita tanto la auto-escalación como el auto-bloqueo accidental.
  IF p_usuario_id = v_actor_id THEN
    RAISE EXCEPTION 'No puedes modificar tu propio rol.'
      USING ERRCODE = '42501';
  END IF;

  -- (c) El rol 'desarrollador' NO se otorga desde la aplicación.
  --     Solo por SQL manual con acceso directo al proyecto Supabase.
  IF p_rol = 'desarrollador' THEN
    RAISE EXCEPTION 'El rol desarrollador solo puede asignarse manualmente por SQL.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_rol_actual
    FROM public.profiles WHERE id = p_usuario_id;

  IF v_rol_actual IS NULL THEN
    RAISE EXCEPTION 'El usuario indicado no existe.'
      USING ERRCODE = 'P0002';
  END IF;

  -- (d) Un desarrollador existente no puede ser degradado desde la UI.
  IF v_rol_actual = 'desarrollador' THEN
    RAISE EXCEPTION 'No se puede modificar el rol de un desarrollador desde la aplicación.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET role = p_rol WHERE id = p_usuario_id;

  SELECT email INTO v_email_target FROM auth.users WHERE id = p_usuario_id;

  INSERT INTO public.registro_auditoria (usuario_id, email, accion, exito, detalle)
  VALUES (
    v_actor_id,
    (SELECT email FROM auth.users WHERE id = v_actor_id),
    'ROL_ASIGNADO',
    true,
    format('Usuario %s (%s): %s → %s', p_usuario_id, coalesce(v_email_target, 's/e'), v_rol_actual, p_rol)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'usuario_id', p_usuario_id,
    'rol_anterior', v_rol_actual,
    'rol_nuevo', p_rol
  );
END;
$$;

-- =========================
-- 3. RPC asignar_permiso — con KERNEL DE SEGURIDAD
-- =========================
-- El kernel está HARDCODEADO en el cuerpo de la función, no en una tabla.
-- Razón: una función SECURITY DEFINER propiedad de postgres no puede ser
-- alterada por el rol `authenticated`. Si el kernel viviera en una tabla,
-- sería un objetivo más para escalar privilegios.

CREATE OR REPLACE FUNCTION public.asignar_permiso(
  p_rol            public.rol_usuario,
  p_permiso_codigo text,
  p_activo         boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
BEGIN
  -- (a) Solo el desarrollador configura permisos.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_actor_id AND role = 'desarrollador'
  ) THEN
    RAISE EXCEPTION 'No autorizado: se requiere rol desarrollador para configurar permisos.'
      USING ERRCODE = '42501';
  END IF;

  -- (b) El permiso debe existir en el catálogo.
  IF NOT EXISTS (SELECT 1 FROM public.permisos WHERE codigo = p_permiso_codigo) THEN
    RAISE EXCEPTION 'El permiso "%" no existe en el catálogo.', p_permiso_codigo
      USING ERRCODE = 'P0002';
  END IF;

  -- (c) KERNEL — permisos de autorización de excepciones.
  --     Jamás pueden otorgarse a 'cajero'. Si esto se pudiera configurar,
  --     un cajero podría autorizarse a sí mismo ventas con stock negativo
  --     o descuentos, destruyendo la separación de funciones completa.
  IF p_permiso_codigo IN (
       'ventas.autorizar_stock_negativo',
       'ventas.autorizar_descuento',
       'ventas.anular'
     )
     AND p_activo
     AND p_rol NOT IN ('admin', 'desarrollador') THEN
    RAISE EXCEPTION
      'El permiso "%" es crítico y solo puede asignarse a admin o desarrollador.', p_permiso_codigo
      USING ERRCODE = '42501';
  END IF;

  -- (d) KERNEL — permisos de sistema. Exclusivos del desarrollador.
  IF p_permiso_codigo IN (
       'sistema.gestionar_usuarios',
       'sistema.asignar_roles'
     )
     AND p_activo
     AND p_rol <> 'desarrollador' THEN
    RAISE EXCEPTION
      'El permiso "%" es exclusivo del rol desarrollador.', p_permiso_codigo
      USING ERRCODE = '42501';
  END IF;

  -- (e) KERNEL — protección anti-lockout.
  --     No se pueden retirar permisos al desarrollador: si se le quitara
  --     'sistema.asignar_roles', nadie podría volver a configurar nada
  --     sin acceso SQL directo al proyecto.
  IF p_rol = 'desarrollador' AND NOT p_activo THEN
    RAISE EXCEPTION 'No se pueden retirar permisos al rol desarrollador.'
      USING ERRCODE = '42501';
  END IF;

  -- (f) Aplicar
  IF p_activo THEN
    INSERT INTO public.rol_permisos (rol, permiso_codigo)
    VALUES (p_rol, p_permiso_codigo)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.rol_permisos
     WHERE rol = p_rol AND permiso_codigo = p_permiso_codigo;
  END IF;

  INSERT INTO public.registro_auditoria (usuario_id, email, accion, exito, detalle)
  VALUES (
    v_actor_id,
    (SELECT email FROM auth.users WHERE id = v_actor_id),
    'PERMISO_CONFIGURADO',
    true,
    format('Rol %s: permiso %s → %s', p_rol, p_permiso_codigo,
           CASE WHEN p_activo THEN 'OTORGADO' ELSE 'REVOCADO' END)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'rol', p_rol,
    'permiso', p_permiso_codigo,
    'activo', p_activo
  );
END;
$$;

-- =========================
-- 4. Privilegios de ejecución
-- =========================

REVOKE EXECUTE ON FUNCTION public.asignar_rol(uuid, public.rol_usuario)              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.asignar_permiso(public.rol_usuario, text, boolean) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.asignar_rol(uuid, public.rol_usuario)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.asignar_permiso(public.rol_usuario, text, boolean)  TO authenticated, service_role;

-- ============================================================
-- 5. PASO MANUAL POST-MIGRACIÓN (NO automatizable)
-- ============================================================
-- Ejecutar UNA VEZ por proyecto Supabase (Tokyo, Yireh, dev), en el
-- SQL Editor, sustituyendo el correo por el tuyo:
--
--   UPDATE public.profiles
--      SET role = 'desarrollador'
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'TU_CORREO@dominio.com');
--
-- Esta sentencia es intencionalmente manual: la RPC asignar_rol bloquea
-- la asignación del rol desarrollador, así que el único camino es acceso
-- directo al proyecto. Es el ancla de confianza de todo el modelo.
--
-- Verificar después:
--   SELECT u.email, p.role FROM public.profiles p
--     JOIN auth.users u ON u.id = p.id ORDER BY p.role;
-- ============================================================

NOTIFY pgrst, 'reload schema';
