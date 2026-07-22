-- ============================================================
-- Migración 00006: Función RPC atómica para procesamiento de ventas
-- Garantiza cumplimiento de sk_logica-critica-ventas-stock:
-- 1. Transacción atómica completa (todo o nada).
-- 2. Bloqueo de filas en productos (SELECT ... FOR UPDATE).
-- 3. Verificación de stock o excepción si falta stock y no está autorizado.
-- 4. Creación de venta (snapshot tasa_cambio_aplicada + total_bs),
--    detalle_venta (precio congelado), descuento de stock_actual y
--    registro en movimientos_inventario.
-- ============================================================

CREATE OR REPLACE FUNCTION public.procesar_venta_transaccion(
  p_cliente_id            uuid,
  p_subtotal_usd          numeric(10,2),
  p_descuento_usd         numeric(10,2),
  p_total_usd             numeric(10,2),
  p_tasa_cambio_aplicada  numeric(10,4),
  p_total_bs              numeric(12,2),
  p_metodo_pago           public.metodo_pago,
  p_items                 jsonb,
  p_permitir_stock_negativo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venta_id          uuid;
  v_item              jsonb;
  v_producto_id       uuid;
  v_cantidad          numeric(10,2);
  v_precio_unitario   numeric(10,2);
  v_subtotal_linea    numeric(10,2);
  v_stock_actual      numeric(10,2);
  v_nombre_producto   text;
  v_fecha_venta       timestamptz := now();
BEGIN
  -- Validar que p_items sea un array JSON no vacío
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito de venta no contiene ningún producto.';
  END IF;

  -- 1. Bloqueo de filas y verificación de stock para cada producto en el carrito
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;

    -- Bloqueo FOR UPDATE
    SELECT stock_actual, nombre
      INTO v_stock_actual, v_nombre_producto
      FROM public.productos
     WHERE id = v_producto_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe en el catálogo.', v_producto_id;
    END IF;

    -- Validar suficiencia de stock salvo que esté autorizado explícitamente
    IF NOT p_permitir_stock_negativo AND v_stock_actual < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock disponible: %, Solicitado: %',
        v_nombre_producto, v_stock_actual, v_cantidad;
    END IF;
  END LOOP;

  -- 2. Insertar cabecera de la venta (snapshot congelado de tasa y montos)
  INSERT INTO public.ventas (
    cliente_id,
    fecha,
    subtotal_usd,
    descuento_usd,
    total_usd,
    tasa_cambio_aplicada,
    total_bs,
    metodo_pago,
    estado,
    sincronizado
  ) VALUES (
    p_cliente_id,
    v_fecha_venta,
    p_subtotal_usd,
    p_descuento_usd,
    p_total_usd,
    p_tasa_cambio_aplicada,
    p_total_bs,
    p_metodo_pago,
    'completada',
    true
  )
  RETURNING id INTO v_venta_id;

  -- 3. Procesar líneas del detalle, descontar stock y generar movimientos_inventario
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id     := (v_item->>'producto_id')::uuid;
    v_cantidad        := (v_item->>'cantidad')::numeric;
    v_precio_unitario := (v_item->>'precio_unitario_usd')::numeric;
    v_subtotal_linea  := (v_item->>'subtotal_usd')::numeric;

    -- Insertar línea de detalle
    INSERT INTO public.detalle_venta (
      venta_id,
      producto_id,
      cantidad,
      precio_unitario_usd,
      subtotal_usd
    ) VALUES (
      v_venta_id,
      v_producto_id,
      v_cantidad,
      v_precio_unitario,
      v_subtotal_linea
    );

    -- Descontar stock del producto
    UPDATE public.productos
       SET stock_actual = stock_actual - v_cantidad,
           updated_at = now()
     WHERE id = v_producto_id;

    -- Registrar movimiento de inventario con referencia a la venta
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
        WHEN p_permitir_stock_negativo THEN 'Venta en POS (con autorización de stock insuficiente)'
        ELSE 'Venta en POS'
      END,
      v_venta_id
    );
  END LOOP;

  -- 4. Retornar resultado con datos confirmados de la venta para el recibo
  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'fecha', v_fecha_venta,
    'total_usd', p_total_usd,
    'total_bs', p_total_bs,
    'tasa_cambio_aplicada', p_tasa_cambio_aplicada
  );
END;
$$;
