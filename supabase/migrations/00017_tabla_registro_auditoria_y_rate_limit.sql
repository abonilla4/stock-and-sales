-- ============================================================
-- Migración 00017: Tabla registro_auditoria y RPC verificar_y_registrar_intento_admin
-- ============================================================

-- 1. Crear tabla registro_auditoria si no existe
CREATE TABLE IF NOT EXISTS public.registro_auditoria (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email        text,
  accion       text NOT NULL,
  exito        boolean NOT NULL DEFAULT false,
  detalle      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registro_auditoria ENABLE ROW LEVEL SECURITY;

-- Política RLS: Usuarios autenticados pueden consultar e insertar en auditoría
CREATE POLICY "Authenticated users can select/insert audit logs"
  ON public.registro_auditoria
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Index para búsquedas rápidas por usuario y ventana de tiempo
CREATE INDEX IF NOT EXISTS idx_registro_auditoria_usuario_ventana
  ON public.registro_auditoria (usuario_id, accion, created_at DESC);

-- 2. Crear RPC verificar_y_registrar_intento_admin con pg_advisory_xact_lock
CREATE OR REPLACE FUNCTION public.verificar_y_registrar_intento_admin(
  p_usuario_id uuid,
  p_email      text,
  p_exito      boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intentos_fallidos   integer := 0;
  v_intentos_restantes  integer := 0;
  v_max_intentos        integer := 5;
  v_ventana_minutos     interval := INTERVAL '5 minutes';
BEGIN
  -- 1. Serialización concurrente por usuario vía pg_advisory_xact_lock
  PERFORM pg_advisory_xact_lock(hashtext(p_usuario_id::text));

  -- 2. Contar intentos fallidos en los últimos 5 minutos
  SELECT count(*)
    INTO v_intentos_fallidos
    FROM public.registro_auditoria
   WHERE usuario_id = p_usuario_id
     AND accion = 'AUTORIZACION_ADMIN_FALLIDA'
     AND created_at >= (now() - v_ventana_minutos);

  -- 3. Si ya alcanzó los 5 intentos fallidos, retornar bloqueado = true sin insertar fila adicional
  IF v_intentos_fallidos >= v_max_intentos THEN
    RETURN jsonb_build_object(
      'bloqueado', true,
      'intentos_fallidos', v_intentos_fallidos,
      'intentos_restantes', 0,
      'mensaje', 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por 5 minutos.'
    );
  END IF;

  -- 4. Si la autenticación fue exitosa, registrar éxito y retornar no bloqueado
  IF p_exito THEN
    INSERT INTO public.registro_auditoria (
      usuario_id,
      email,
      accion,
      exito,
      detalle
    ) VALUES (
      p_usuario_id,
      p_email,
      'AUTORIZACION_ADMIN_EXITOSA',
      true,
      'Autorización de excepción concedida exitosamente'
    );

    RETURN jsonb_build_object(
      'bloqueado', false,
      'intentos_fallidos', 0,
      'intentos_restantes', v_max_intentos,
      'mensaje', NULL
    );
  END IF;

  -- 5. Si la autenticación falló, insertar el nuevo intento fallido
  INSERT INTO public.registro_auditoria (
    usuario_id,
    email,
    accion,
    exito,
    detalle
  ) VALUES (
    p_usuario_id,
    p_email,
    'AUTORIZACION_ADMIN_FALLIDA',
    false,
    format('Clave Admin incorrecta (Intento %s/%s)', v_intentos_fallidos + 1, v_max_intentos)
  );

  v_intentos_fallidos := v_intentos_fallidos + 1;
  v_intentos_restantes := GREATEST(0, v_max_intentos - v_intentos_fallidos);

  RETURN jsonb_build_object(
    'bloqueado', (v_intentos_fallidos >= v_max_intentos),
    'intentos_fallidos', v_intentos_fallidos,
    'intentos_restantes', v_intentos_restantes,
    'mensaje', CASE
                 WHEN v_intentos_fallidos >= v_max_intentos THEN 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por 5 minutos.'
                 ELSE NULL
               END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
