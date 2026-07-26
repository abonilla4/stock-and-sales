-- ============================================================
-- Migración 00016: Límite de descuento, autorización admin y columna motivos_autorizacion
-- 1. Agrega la columna motivos_autorizacion text[] a ventas.
-- 2. Limpia sobrecargas previas de procesar_venta_transaccion.
-- 3. Recrea procesar_venta_transaccion recalculando el porcentaje real de descuento server-side.
--    Si descuento > 5% o stock es insuficiente/negativo, exige p_autorizado_por.
--    Registra los motivos ('stock_negativo', 'descuento_excedido') en motivos_autorizacion.
-- ============================================================

-- 1. Agregar columna motivos_autorizacion
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS motivos_autorizacion text[];

-- 2. Limpiar sobrecargas previas de la función procesar_venta_transaccion
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid);
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid, text);

-- 3. Crear versión actualizada de procesar_venta_transaccion
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
  v_porcentaje_descuento  numeric(10,2) := 0;
  v_fecha_venta           timestamptz := now();
  v_saldo_actual          numeric(10,2);
  v_existing              jsonb;
  v_motivos_autorizacion  text[] := ARRAY[]::text[];
  v_requiere_autorizacion boolean := false;
  v_stock_insuficiente    boolean := false;
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

  -- 1. Obtener la tasa de cambio activa más reciente directamente en la BD
  SELECT tasa INTO v_tasa_real
    FROM public.tasas_cambio
   ORDER BY fecha DESC, created_at DESC
   LIMIT 1;

  IF v_tasa_real IS NULL OR v_tasa_real <= 0 THEN
    v_tasa_real := COALESCE(p_tasa_cambio_aplicada, 1);
  END IF;

  -- 2. Bloqueo FOR UPDATE, verificación de stock y recálculo estricto de precios por producto
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

    IF v_stock_actual < v_cantidad THEN
      v_stock_insuficiente := true;
      IF NOT p_permitir_stock_negativo THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock disponible: %, Solicitado: %',
          v_nombre_producto, v_stock_actual, v_cantidad;
      END IF;
    END IF;

    v_subtotal_linea_real := ROUND(v_cantidad * v_precio_venta_real, 2);
    v_subtotal_real := v_subtotal_real + v_subtotal_linea_real;
  END LOOP;

  -- 3. Calcular totales finales recalculados server-side
  v_subtotal_real := ROUND(v_subtotal_real, 2);
  v_total_real    := GREATEST(0, ROUND(v_subtotal_real - v_descuento_real, 2));
  v_total_bs_real := ROUND(v_total_real * v_tasa_real, 2);

  -- 4. Validar tolerancia entre total recalculado server-side y el enviado por la UI (0.01 USD)
  IF ABS(v_total_real - p_total_usd) > 0.01 THEN
    RAISE EXCEPTION 'El precio de uno o más productos o la tasa de cambio cambió (Total catálogo: $%, Carrito enviado: $%). Actualiza el carrito e intenta de nuevo.',
      v_total_real, p_total_usd;
  END IF;

  -- 5. Recalcular el porcentaje real de descuento server-side
  IF v_subtotal_real > 0 THEN
    v_porcentaje_descuento := ROUND((v_descuento_real / v_subtotal_real) * 100.0, 2);
  ELSE
    v_porcentaje_descuento := 0;
  END IF;

  -- 6. Construir motivos de autorización requeridos
  IF v_stock_insuficiente OR p_permitir_stock_negativo THEN
    v_motivos_autorizacion := array_append(v_motivos_autorizacion, 'stock_negativo');
    v_requiere_autorizacion := true;
  END IF;

  IF v_porcentaje_descuento > 5.0 THEN
    v_motivos_autorizacion := array_append(v_motivos_autorizacion, 'descuento_excedido');
    v_requiere_autorizacion := true;
  END IF;

  -- 7. Validar si requiere autorización de Administrador
  IF v_requiere_autorizacion THEN
    IF p_origen_autorizacion = 'offline_diferido' THEN
      v_autorizado_por := NULL;
      v_autorizado_en := now();
      v_origen_autorizacion := 'offline_diferido';
    ELSE
      IF p_autorizado_por IS NULL THEN
        IF v_porcentaje_descuento > 5.0 AND v_stock_insuficiente THEN
          RAISE EXCEPTION 'Se requiere autorización de Administrador por stock negativo y descuento del % (límite 5%%).', v_porcentaje_descuento;
        ELSIF v_porcentaje_descuento > 5.0 THEN
          RAISE EXCEPTION 'El descuento del % excede el límite permitido sin autorización (5%%). Se requiere autorización de Administrador.', v_porcentaje_descuento;
        ELSE
          RAISE EXCEPTION 'Se requiere autorización de Administrador para vender con stock negativo en línea.';
        END IF;
      END IF;
      v_autorizado_por := p_autorizado_por;
      v_autorizado_en := now();
      v_origen_autorizacion := 'admin_online';
    END IF;
  ELSE
    v_motivos_autorizacion := NULL;
  END IF;

  -- 8. Bloqueo FOR UPDATE del cliente si es crédito / fiado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    SELECT saldo_fiado INTO v_saldo_actual
      FROM public.clientes
     WHERE id = p_cliente_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El cliente con ID % no existe.', p_cliente_id;
    END IF;
  END IF;

  -- 9. Insertar cabecera de la venta con valores recalculados server-side y motivos_autorizacion
  INSERT INTO public.ventas (
    cliente_id, fecha, subtotal_usd, descuento_usd, total_usd,
    tasa_cambio_aplicada, total_bs, metodo_pago, estado, sincronizado,
    client_tx_id, autorizado_por, autorizado_en, origen_autorizacion,
    motivos_autorizacion
  ) VALUES (
    p_cliente_id, v_fecha_venta, v_subtotal_real, v_descuento_real, v_total_real,
    v_tasa_real, v_total_bs_real, p_metodo_pago, 'completada', true,
    p_client_tx_id, v_autorizado_por, v_autorizado_en, v_origen_autorizacion,
    v_motivos_autorizacion
  )
  RETURNING id INTO v_venta_id;

  -- 10. Insertar líneas de detalle con precios reales del catálogo y descontar stock
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

  -- 11. Si es fiado / crédito, incrementar saldo_fiado con v_total_real recalculado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    UPDATE public.clientes
       SET saldo_fiado = saldo_fiado + v_total_real,
           updated_at = now()
     WHERE id = p_cliente_id;
  END IF;

  -- 12. Retornar resultado
  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'fecha', v_fecha_venta,
    'total_usd', v_total_real,
    'total_bs', v_total_bs_real,
    'tasa_cambio_aplicada', v_tasa_real,
    'motivos_autorizacion', v_motivos_autorizacion
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
