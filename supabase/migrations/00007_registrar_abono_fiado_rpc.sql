-- ============================================================
-- Migración 00007: Función RPC atómica para registrar abonos de fiado
-- 1. Inserta en la tabla pagos_fiado con fecha, montos y método de pago.
-- 2. Descuenta de manera atómica el saldo_fiado del cliente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_abono_fiado(
  p_cliente_id    uuid,
  p_monto_usd     numeric(10,2),
  p_monto_bs      numeric(12,2),
  p_metodo_pago   public.metodo_pago,
  p_venta_id      uuid DEFAULT NULL,
  p_notas         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pago_id         uuid;
  v_saldo_actual    numeric(10,2);
  v_nuevo_saldo     numeric(10,2);
  v_fecha_pago      timestamptz := now();
BEGIN
  -- 1. Obtener y bloquear la fila del cliente
  SELECT saldo_fiado INTO v_saldo_actual
    FROM public.clientes
   WHERE id = p_cliente_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cliente con ID % no existe.', p_cliente_id;
  END IF;

  IF p_monto_usd <= 0 THEN
    RAISE EXCEPTION 'El monto del abono debe ser mayor a 0.';
  END IF;

  -- 2. Insertar el abono en pagos_fiado
  INSERT INTO public.pagos_fiado (
    cliente_id,
    venta_id,
    monto_usd,
    monto_bs,
    metodo_pago,
    fecha,
    notas
  ) VALUES (
    p_cliente_id,
    p_venta_id,
    p_monto_usd,
    p_monto_bs,
    p_metodo_pago,
    v_fecha_pago,
    p_notas
  )
  RETURNING id INTO v_pago_id;

  -- 3. Calcular y actualizar el nuevo saldo_fiado del cliente
  v_nuevo_saldo := GREATEST(0, v_saldo_actual - p_monto_usd);

  UPDATE public.clientes
     SET saldo_fiado = v_nuevo_saldo,
         updated_at = now()
   WHERE id = p_cliente_id;

  -- 4. Retornar JSON con la confirmación
  RETURN jsonb_build_object(
    'pago_id', v_pago_id,
    'cliente_id', p_cliente_id,
    'monto_usd', p_monto_usd,
    'monto_bs', p_monto_bs,
    'nuevo_saldo_usd', v_nuevo_saldo,
    'fecha', v_fecha_pago
  );
END;
$$;
