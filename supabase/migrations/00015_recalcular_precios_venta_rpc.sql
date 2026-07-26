-- ============================================================
-- Migración 00015: Recálculo de precios y validación de seguridad en procesar_venta_transaccion
-- NUNCA confía en precios unitarios ni totales del cliente.
-- Obtiene precio_venta_usd y precio_costo_usd directamente de productos.
-- Recalcula subtotal_usd, total_usd y total_bs server-side.
-- Valida tolerancia (0.01) contra p_total_usd enviado.
-- ============================================================

-- Limpiar sobrecargas previas de la función para evitar error PGRST203 de PostgREST
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid);
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.procesar_venta_transaccion(
  p_cliente_id              uuid,
  p_subtotal_usd            numeric(10,2),
  p_descuento_usd           numeric(10,2),
  p_total_usd               numeric(10,2),
  p_tasa_cambio_aplicada    numeric(10,4),
  p_total_bs                numeric(12,2),
  p_metodo_pago             public.metodo_pago,
  p_items                   jsonb,
  p_permitir_stock_negativo boolean DEFAULT false,
  p_client_tx_id            uuid DEFAULT NULL,
  p_autorizado_por          uuid DEFAULT NULL,
  p_origen_autorizacion     text DEFAULT 'admin_online'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venta_id              uuid;
  v_item                  jsonb;
  v_producto_id           uuid;
  v_cantidad              numeric(10,2);
  v_stock_actual          numeric(10,2);
  v_precio_venta_real     numeric(10,2);
  v_precio_costo_actual   numeric(10,2);
  v_nombre_producto       text;
  v_subtotal_linea_real   numeric(10,2);
  v_subtotal_real         numeric(10,2) := 0;
  v_total_real            numeric(10,2) := 0;
  v_tasa_real             numeric(10,4) := 1;
  v_total_bs_real         numeric(12,2) := 0;
  v_descuento_real        numeric(10,2) := COALESCE(p_descuento_usd, 0);
  v_fecha_venta           timestamptz := now();
  v_saldo_actual          numeric(10,2);
  v_existing              jsonb;
  v_autorizado_por        uuid := NULL;
  v_autorizado_en         timestamptz := NULL;
  v_origen_autorizacion   text := NULL;
BEGIN
  -- 0. Idempotencia por client_tx_id
  IF p_client_tx_id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'venta_id', v.id,
             'fecha', v.fecha,
             'total_usd', v.total_usd,
             'total_bs', v.total_bs,
             'tasa_cambio_aplicada', v.tasa_cambio_aplicada,
             'duplicado', true
           )
      INTO v_existing
      FROM public.ventas v
     WHERE v.client_tx_id = p_client_tx_id;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito de venta no contiene ningún producto.';
  END IF;

  -- Obtener la tasa de cambio activa más reciente directamente en la BD
  SELECT tasa INTO v_tasa_real
    FROM public.tasas_cambio
   ORDER BY fecha DESC, created_at DESC
   LIMIT 1;

  IF v_tasa_real IS NULL OR v_tasa_real <= 0 THEN
    v_tasa_real := COALESCE(p_tasa_cambio_aplicada, 1);
  END IF;

  -- Lógica de Autorización según origen
  IF p_permitir_stock_negativo THEN
    IF p_origen_autorizacion = 'offline_diferido' THEN
      v_autorizado_por := NULL;
      v_autorizado_en := now();
      v_origen_autorizacion := 'offline_diferido';
    ELSE
      IF p_autorizado_por IS NULL THEN
        RAISE EXCEPTION 'Se requiere autorizado_por cuando se permite stock negativo en línea.';
      END IF;
      v_autorizado_por := p_autorizado_por;
      v_autorizado_en := now();
      v_origen_autorizacion := 'admin_online';
    END IF;
  END IF;

  -- 1. Bloqueo FOR UPDATE, verificación de stock y recálculo estricto de precios por producto
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;

    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad del producto debe ser mayor a cero.';
    END IF;

    -- Obtener datos reales y bloquear fila
    SELECT stock_actual, nombre, precio_venta_usd, COALESCE(precio_costo_usd, 0)
      INTO v_stock_actual, v_nombre_producto, v_precio_venta_real, v_precio_costo_actual
      FROM public.productos
     WHERE id = v_producto_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe en el catálogo.', v_producto_id;
    END IF;

    IF NOT p_permitir_stock_negativo AND v_stock_actual < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock disponible: %, Solicitado: %',
        v_nombre_producto, v_stock_actual, v_cantidad;
    END IF;

    -- Calcular subtotal real de la línea usando precio_venta_usd del catálogo
    v_subtotal_linea_real := ROUND(v_cantidad * v_precio_venta_real, 2);
    v_subtotal_real := v_subtotal_real + v_subtotal_linea_real;
  END LOOP;

  -- 2. Calcular total final recalculado server-side
  v_subtotal_real := ROUND(v_subtotal_real, 2);
  v_total_real    := GREATEST(0, ROUND(v_subtotal_real - v_descuento_real, 2));
  v_total_bs_real := ROUND(v_total_real * v_tasa_real, 2);

  -- 3. Validar tolerancia entre total recalculado server-side y el enviado por la UI
  IF ABS(v_total_real - p_total_usd) > 0.01 THEN
    RAISE EXCEPTION 'El precio de uno o más productos o la tasa de cambio cambió (Total catálogo: $%, Carrito enviado: $%). Actualiza el carrito e intenta de nuevo.',
      v_total_real, p_total_usd;
  END IF;

  -- 4. Bloqueo FOR UPDATE del cliente si es crédito / fiado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    SELECT saldo_fiado INTO v_saldo_actual
      FROM public.clientes
     WHERE id = p_cliente_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El cliente con ID % no existe.', p_cliente_id;
    END IF;
  END IF;

  -- 5. Insertar cabecera de la venta con valores recalculados server-side
  INSERT INTO public.ventas (
    cliente_id, fecha, subtotal_usd, descuento_usd, total_usd,
    tasa_cambio_aplicada, total_bs, metodo_pago, estado, sincronizado,
    client_tx_id, autorizado_por, autorizado_en, origen_autorizacion
  ) VALUES (
    p_cliente_id, v_fecha_venta, v_subtotal_real, v_descuento_real, v_total_real,
    v_tasa_real, v_total_bs_real, p_metodo_pago, 'completada', true,
    p_client_tx_id, v_autorizado_por, v_autorizado_en, v_origen_autorizacion
  )
  RETURNING id INTO v_venta_id;

  -- 6. Insertar líneas de detalle con precios reales del catálogo y descontar stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;

    SELECT precio_venta_usd, COALESCE(precio_costo_usd, 0)
      INTO v_precio_venta_real, v_precio_costo_actual
      FROM public.productos
     WHERE id = v_producto_id;

    v_subtotal_linea_real := ROUND(v_cantidad * v_precio_venta_real, 2);

    INSERT INTO public.detalle_venta (
      venta_id,
      producto_id,
      cantidad,
      precio_unitario_usd,
      costo_unitario_usd,
      subtotal_usd
    ) VALUES (
      v_venta_id,
      v_producto_id,
      v_cantidad,
      v_precio_venta_real,
      v_precio_costo_actual,
      v_subtotal_linea_real
    );

    UPDATE public.productos
       SET stock_actual = stock_actual - v_cantidad,
           updated_at = now()
     WHERE id = v_producto_id;

    INSERT INTO public.movimientos_inventario (
      producto_id,
      tipo,
      cantidad,
      motivo,
      referencia_venta_id
    ) VALUES (
      v_producto_id,
      'venta',
      v_cantidad,
      CASE
        WHEN p_permitir_stock_negativo AND p_origen_autorizacion = 'offline_diferido' THEN 'Venta en POS (sincronización offline con stock insuficiente diferido)'
        WHEN p_permitir_stock_negativo THEN 'Venta en POS (autorizado por admin en línea)'
        ELSE 'Venta en POS'
      END,
      v_venta_id
    );
  END LOOP;

  -- 7. Si es fiado / crédito, incrementar saldo_fiado con v_total_real recalculado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    UPDATE public.clientes
       SET saldo_fiado = saldo_fiado + v_total_real,
           updated_at = now()
     WHERE id = p_cliente_id;
  END IF;

  -- 8. Retornar resultado
  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'fecha', v_fecha_venta,
    'total_usd', v_total_real,
    'total_bs', v_total_bs_real,
    'tasa_cambio_aplicada', v_tasa_real
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
