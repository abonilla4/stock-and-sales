-- ============================================================
-- Migración 00012: Congelar costo_unitario_usd en detalle_venta
-- 1. Agrega la columna costo_unitario_usd a detalle_venta.
-- 2. Puebla costo_unitario_usd para registros existentes desde productos (o 0 si no existe).
-- 3. Actualiza procesar_venta_transaccion RPC para guardar precio_costo_usd en costo_unitario_usd al momento de la venta.
-- ============================================================

-- 1. Agregar columna costo_unitario_usd
ALTER TABLE public.detalle_venta
  ADD COLUMN IF NOT EXISTS costo_unitario_usd numeric(10,2);

-- 2. Poblar registros históricos existentes
UPDATE public.detalle_venta dv
   SET costo_unitario_usd = COALESCE(p.precio_costo_usd, 0)
  FROM public.productos p
 WHERE dv.producto_id = p.id
   AND dv.costo_unitario_usd IS NULL;

-- 3. Recrear procesar_venta_transaccion
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
  v_precio_unitario       numeric(10,2);
  v_subtotal_linea        numeric(10,2);
  v_stock_actual          numeric(10,2);
  v_precio_costo_actual   numeric(10,2);
  v_nombre_producto       text;
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

  -- 1. Bloqueo FOR UPDATE y verificación de stock por cada producto
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;

    SELECT stock_actual, nombre
      INTO v_stock_actual, v_nombre_producto
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
  END LOOP;

  -- 2. Bloqueo FOR UPDATE del cliente si es fiado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    SELECT saldo_fiado INTO v_saldo_actual
      FROM public.clientes
     WHERE id = p_cliente_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El cliente con ID % no existe.', p_cliente_id;
    END IF;
  END IF;

  -- 3. Insertar cabecera de la venta
  INSERT INTO public.ventas (
    cliente_id, fecha, subtotal_usd, descuento_usd, total_usd,
    tasa_cambio_aplicada, total_bs, metodo_pago, estado, sincronizado,
    client_tx_id, autorizado_por, autorizado_en, origen_autorizacion
  ) VALUES (
    p_cliente_id, v_fecha_venta, p_subtotal_usd, p_descuento_usd, p_total_usd,
    p_tasa_cambio_aplicada, p_total_bs, p_metodo_pago, 'completada', true,
    p_client_tx_id, v_autorizado_por, v_autorizado_en, v_origen_autorizacion
  )
  RETURNING id INTO v_venta_id;

  -- 4. Procesar líneas: detalle con costo_unitario_usd congelado
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id     := (v_item->>'producto_id')::uuid;
    v_cantidad        := (v_item->>'cantidad')::numeric;
    v_precio_unitario := (v_item->>'precio_unitario_usd')::numeric;
    v_subtotal_linea  := (v_item->>'subtotal_usd')::numeric;

    -- Obtener el costo unitario actual del producto para congelarlo en esta venta
    SELECT COALESCE(precio_costo_usd, 0)
      INTO v_precio_costo_actual
      FROM public.productos
     WHERE id = v_producto_id;

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
      v_precio_unitario,
      v_precio_costo_actual,
      v_subtotal_linea
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

  -- 5. Si es fiado, incrementar saldo_fiado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    UPDATE public.clientes
       SET saldo_fiado = saldo_fiado + p_total_usd,
           updated_at = now()
     WHERE id = p_cliente_id;
  END IF;

  -- 6. Retornar resultado
  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'fecha', v_fecha_venta,
    'total_usd', p_total_usd,
    'total_bs', p_total_bs,
    'tasa_cambio_aplicada', p_tasa_cambio_aplicada
  );
END;
$$;
