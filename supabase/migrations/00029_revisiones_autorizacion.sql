-- ============================================================
-- Migración 00029: Revisión de autorizaciones offline diferidas
--
-- CIERRA LA DEUDA abierta por la migración 00011: una venta sincronizada
-- con origen_autorizacion = 'offline_diferido' quedó con autorizado_por
-- NULL, porque en el mostrador sin conexión no había un administrador que
-- la autorizara. Esas ventas existen, movieron stock, y hasta ahora nadie
-- las revisaba a posteriori.
--
-- La revisión se registra en una tabla APARTE. `ventas` no se toca: es un
-- snapshot inmutable del momento de la venta, y la revisión es un hecho
-- posterior sobre ese snapshot, no una corrección de él.
--
-- Mismo patrón de blindaje que la 00028:
--   1. RLS habilitado en la misma migración que crea la tabla.
--   2. Solo política de SELECT. Ninguna de escritura, a propósito.
--   3. REVOKE de INSERT/UPDATE/DELETE a nivel de tabla.
--   4. La escritura ocurre exclusivamente dentro de una RPC SECURITY
--      DEFINER que valida permiso antes de insertar.
--
-- Requiere: 00027 (tiene_permiso) y el catálogo de la 00026.
-- ============================================================

-- =========================
-- 1. TABLA revisiones_autorizacion
-- =========================

CREATE TABLE IF NOT EXISTS public.revisiones_autorizacion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id      uuid NOT NULL UNIQUE REFERENCES public.ventas(id) ON DELETE CASCADE,
  revisado_por  uuid NOT NULL REFERENCES auth.users(id),
  resultado     text NOT NULL CHECK (resultado IN ('confirmada', 'irregular')),
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.revisiones_autorizacion IS
  'Revisión a posteriori de ventas autorizadas offline. Solo modificable vía RPC revisar_autorizacion_offline.';
COMMENT ON COLUMN public.revisiones_autorizacion.venta_id IS
  'UNIQUE: una venta se revisa una sola vez. Evita que un doble envío en conexión intermitente duplique el dictamen.';
COMMENT ON COLUMN public.revisiones_autorizacion.resultado IS
  'confirmada = la excepción era legítima. irregular = requiere seguimiento del dueño.';

ALTER TABLE public.revisiones_autorizacion ENABLE ROW LEVEL SECURITY;

-- Lectura para quien puede autorizar excepciones: es la misma persona que
-- responde por ellas. Envuelta en subconsulta para que se evalúe una vez por
-- sentencia y no una vez por fila (ver nota de rendimiento en la 00027).
DROP POLICY IF EXISTS "Autorizadores can select revisiones" ON public.revisiones_autorizacion;
CREATE POLICY "Autorizadores can select revisiones"
  ON public.revisiones_autorizacion FOR SELECT
  USING ( (SELECT public.tiene_permiso('ventas.autorizar_stock_negativo')) );

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: la escritura pasa
-- obligatoriamente por la RPC de más abajo.
REVOKE INSERT, UPDATE, DELETE ON public.revisiones_autorizacion FROM authenticated, anon, public;
GRANT SELECT ON public.revisiones_autorizacion TO authenticated;

-- El UNIQUE de venta_id ya provee el índice de búsqueda por venta.
CREATE INDEX IF NOT EXISTS idx_revisiones_autorizacion_created_at
  ON public.revisiones_autorizacion (created_at DESC);

-- =========================
-- 2. RPC revisar_autorizacion_offline
-- =========================

CREATE OR REPLACE FUNCTION public.revisar_autorizacion_offline(
  p_venta_id  uuid,
  p_resultado text,
  p_notas     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id    uuid := (SELECT auth.uid());
  v_origen      text;
  v_revision_id uuid;
BEGIN
  -- (a) Permiso. Se reutiliza el mismo que autoriza la excepción en caliente:
  --     quien puede autorizar una venta con stock insuficiente es quien
  --     responde por revisar las que se autorizaron sin él.
  IF NOT (SELECT public.tiene_permiso('ventas.autorizar_stock_negativo')) THEN
    RAISE EXCEPTION
      'No autorizado: se requiere el permiso ventas.autorizar_stock_negativo para revisar autorizaciones offline.'
      USING ERRCODE = '42501';
  END IF;

  -- (b) Resultado válido. El CHECK de la tabla ya lo garantiza; esto existe
  --     para devolver un mensaje legible en vez de una violación de CHECK.
  IF p_resultado NOT IN ('confirmada', 'irregular') THEN
    RAISE EXCEPTION 'Resultado inválido: debe ser "confirmada" o "irregular".'
      USING ERRCODE = '22023';
  END IF;

  -- (c) La venta debe existir y ser efectivamente una autorización diferida.
  --     Sin FOR UPDATE: esta RPC no escribe en `ventas`, así que no tiene por
  --     qué bloquear una fila de negocio. La concurrencia la resuelve el
  --     UNIQUE de venta_id, capturado más abajo.
  SELECT origen_autorizacion
    INTO v_origen
    FROM public.ventas
   WHERE id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta indicada no existe.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_origen IS DISTINCT FROM 'offline_diferido' THEN
    RAISE EXCEPTION
      'Esta venta no es una autorización offline diferida, no corresponde revisarla.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.revisiones_autorizacion (venta_id, revisado_por, resultado, notas)
  VALUES (p_venta_id, v_actor_id, p_resultado, nullif(btrim(coalesce(p_notas, '')), ''))
  RETURNING id INTO v_revision_id;

  INSERT INTO public.registro_auditoria (usuario_id, email, accion, exito, detalle)
  VALUES (
    v_actor_id,
    (SELECT email FROM auth.users WHERE id = v_actor_id),
    'AUTORIZACION_OFFLINE_REVISADA',
    true,
    format('Venta %s revisada como %s', p_venta_id, p_resultado)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'revision_id', v_revision_id,
    'venta_id', p_venta_id,
    'resultado', p_resultado
  );

EXCEPTION
  -- Dos revisores simultáneos sobre la misma venta: el segundo pierde con un
  -- mensaje claro en vez de un error crudo de restricción.
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta venta ya fue revisada.'
      USING ERRCODE = '23505';
END;
$$;

COMMENT ON FUNCTION public.revisar_autorizacion_offline(uuid, text, text) IS
  'Registra el dictamen sobre una venta autorizada offline. No modifica la venta.';

-- =========================
-- 3. Privilegios de ejecución
-- =========================

REVOKE EXECUTE ON FUNCTION public.revisar_autorizacion_offline(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revisar_autorizacion_offline(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
