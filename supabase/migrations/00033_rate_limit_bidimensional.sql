-- ============================================================
-- Migración 00033: Rate limit bidimensional para autorización delegada
--
-- La RPC verificar_y_registrar_intento_admin (00017) cuenta intentos fallidos
-- por UN solo eje: el usuario en sesión. Servía cuando el flujo era
-- re-autenticar al propio usuario, pero la autorización delegada tiene dos
-- partes distintas y cada una necesita su propio freno:
--
--   • El AUTORIZADOR (identificado por email). Sin este eje, un cajero podría
--     probar contraseñas contra la cuenta de un admin desde varias sesiones,
--     porque cada sesión tendría su propio contador.
--   • El SOLICITANTE (identificado por su uuid de sesión). Sin este eje, un
--     cajero podría rotar el email del autorizador y probar una contraseña
--     distinta contra cada admin del negocio sin nunca agotar un contador.
--
-- Bloquea si CUALQUIERA de los dos ejes supera el límite en la ventana.
--
-- ORDEN DE LOS LOCKS — no reordenar.
--   Se toman dos pg_advisory_xact_lock: primero el del email del autorizador,
--   después el del uuid del solicitante. El orden es fijo a propósito. Si dos
--   transacciones concurrentes los tomaran en órdenes distintos —una A→B y
--   otra B→A— se bloquearían mutuamente y Postgres abortaría una por deadlock.
--   Tomarlos siempre en el mismo orden hace el deadlock imposible por
--   construcción.
--
-- Requiere: 00017 (tabla registro_auditoria).
-- ============================================================

-- =========================
-- 1. COLUMNA solicitante_id
-- =========================
-- La identidad estructurada de `registro_auditoria` (usuario_id + email) está
-- reservada para QUIEN EJERCE LA AUTORIDAD, igual que en asignar_rol y
-- asignar_permiso: ahí el actor es el desarrollador que asigna, y el usuario
-- afectado se menciona en el detalle. Aquí el actor es el administrador que
-- autoriza.
--
-- Pero la autorización delegada tiene un segundo sujeto que el resto de los
-- eventos no tiene: el cajero que PIDE la excepción. No es un dato de contexto
-- que pueda vivir solo en el texto del detalle, porque es un eje del rate
-- limit y hay que contarlo. Guardarlo en `detalle` obligaría a un
-- LIKE '%<uuid>%' sin índice; guardarlo en `usuario_id` desplazaría al
-- autorizador y rompería el patrón.
--
-- De ahí la columna propia: nullable, porque solo la usan los eventos de
-- autorización delegada. Todos los demás eventos la dejan en NULL.
ALTER TABLE public.registro_auditoria
  ADD COLUMN IF NOT EXISTS solicitante_id uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.registro_auditoria.solicitante_id IS
  'Solo en eventos de autorización delegada: quién PIDIÓ la excepción. El autorizador va en usuario_id/email, como en el resto de los eventos.';

-- =========================
-- 2. RPC de rate limit y registro
-- =========================
-- `p_autorizador_id` es nullable a propósito: en un intento FALLIDO las
-- credenciales no resuelven a ningún usuario, así que no hay uuid que guardar.
-- El email siempre está —es lo que se tecleó— y por eso es el email, y no el
-- uuid, lo que ancla el eje del autorizador en el rate limit.
CREATE OR REPLACE FUNCTION public.verificar_y_registrar_intento_autorizacion(
  p_solicitante_id    uuid,
  p_email_autorizador text,
  p_permiso           text,
  p_exito             boolean,
  p_autorizador_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_intentos        integer  := 5;
  v_ventana             interval := INTERVAL '5 minutes';
  v_email_norm          text;
  v_fallos_autorizador  integer  := 0;
  v_fallos_solicitante  integer  := 0;
  v_restantes           integer  := 0;
BEGIN
  -- Normalizar el email: sin esto, "Admin@x.com" y "admin@x.com" serían dos
  -- ejes distintos y el límite se duplicaría con solo cambiar mayúsculas.
  v_email_norm := lower(btrim(coalesce(p_email_autorizador, '')));

  IF v_email_norm = '' THEN
    RAISE EXCEPTION 'Se requiere el email del autorizador.'
      USING ERRCODE = '22023';
  END IF;

  IF p_solicitante_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere el id del solicitante.'
      USING ERRCODE = '22023';
  END IF;

  -- Orden fijo: autorizador, luego solicitante. Ver nota del encabezado.
  PERFORM pg_advisory_xact_lock(hashtext(v_email_norm));
  PERFORM pg_advisory_xact_lock(hashtext(p_solicitante_id::text));

  SELECT count(*)
    INTO v_fallos_autorizador
    FROM public.registro_auditoria
   WHERE accion     = 'AUTORIZACION_DELEGADA_FALLIDA'
     AND email      = v_email_norm
     AND created_at >= (now() - v_ventana);

  -- Eje del solicitante: se cuenta contra solicitante_id, no contra usuario_id,
  -- que ahora identifica al autorizador. Columna propia e indexada, sin LIKE.
  SELECT count(*)
    INTO v_fallos_solicitante
    FROM public.registro_auditoria
   WHERE accion         = 'AUTORIZACION_DELEGADA_FALLIDA'
     AND solicitante_id = p_solicitante_id
     AND created_at    >= (now() - v_ventana);

  -- Si ya está bloqueado no se inserta otra fila: de lo contrario un atacante
  -- extendería su propio bloqueo indefinidamente y ensuciaría la bitácora.
  IF v_fallos_autorizador >= v_max_intentos OR v_fallos_solicitante >= v_max_intentos THEN
    RETURN jsonb_build_object(
      'bloqueado', true,
      'intentos_restantes', 0,
      'eje_bloqueado', CASE
        WHEN v_fallos_autorizador >= v_max_intentos THEN 'autorizador'
        ELSE 'solicitante'
      END,
      'mensaje', 'Demasiados intentos fallidos de autorización. Espera 5 minutos antes de volver a intentar.'
    );
  END IF;

  -- La identidad estructurada corresponde a QUIEN EJERCE LA AUTORIDAD, mismo
  -- criterio que asignar_rol y asignar_permiso: usuario_id + email son siempre
  -- el actor del evento, nunca el sujeto sobre el que actúa. Aquí el actor es
  -- el administrador que autoriza.
  --   usuario_id     = uuid del autorizador (NULL si las credenciales fallaron)
  --   email          = correo del autorizador (siempre presente)
  --   solicitante_id = el cajero que pidió la excepción
  -- El detalle repite ambos en texto para quien lee el panel, que muestra el
  -- email pero no las columnas de uuid.
  INSERT INTO public.registro_auditoria (
    usuario_id, email, solicitante_id, accion, exito, detalle
  )
  VALUES (
    p_autorizador_id,
    v_email_norm,
    p_solicitante_id,
    CASE WHEN p_exito THEN 'AUTORIZACION_DELEGADA_EXITOSA' ELSE 'AUTORIZACION_DELEGADA_FALLIDA' END,
    p_exito,
    format(
      'Autorización de "%s" con las credenciales de %s, solicitada por %s',
      coalesce(p_permiso, 's/e'), v_email_norm, p_solicitante_id
    )
  );

  v_restantes := v_max_intentos - GREATEST(v_fallos_autorizador, v_fallos_solicitante)
                 - CASE WHEN p_exito THEN 0 ELSE 1 END;

  RETURN jsonb_build_object(
    'bloqueado', false,
    'intentos_restantes', GREATEST(v_restantes, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.verificar_y_registrar_intento_autorizacion(uuid, text, text, boolean, uuid) IS
  'Rate limit de autorización delegada por dos ejes (autorizador y solicitante) y registro del intento. Los advisory locks se toman siempre en el mismo orden para no generar deadlocks.';

-- Un índice por eje. El de la 00017 cubre (usuario_id, accion, created_at) y ya
-- no sirve para ninguno de los dos: usuario_id es el autorizador, cuyo eje se
-- ancla en el email porque en los intentos fallidos no hay uuid.
CREATE INDEX IF NOT EXISTS idx_registro_auditoria_email_ventana
  ON public.registro_auditoria (email, accion, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_registro_auditoria_solicitante_ventana
  ON public.registro_auditoria (solicitante_id, accion, created_at DESC);

REVOKE EXECUTE ON FUNCTION public.verificar_y_registrar_intento_autorizacion(uuid, text, text, boolean, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.verificar_y_registrar_intento_autorizacion(uuid, text, text, boolean, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- NOTA — verificar_y_registrar_intento_admin (00017) queda huérfana
-- ============================================================
-- Tras el refactor de autorizarVentaAdmin, ninguna ruta de la aplicación la
-- invoca. No se elimina aquí a propósito: borrarla es un cambio destructivo
-- independiente de esta migración, y conviene confirmar antes que ningún otro
-- consumidor la use. Queda anotado como limpieza pendiente.
-- ============================================================
