-- ============================================================
-- Migración 00024: Validación de Unidades Enteras (Sin Decimales)
-- 1. Agrega CHECK constraint 'check_stock_entero' en tabla productos.
-- 2. Actualiza RPC registrar_movimiento_inventario con validación de enteros para ('unidad','par','caja').
-- 3. Actualiza RPC procesar_venta_transaccion con validación de enteros para ('unidad','par','caja').
-- ============================================================

-- 1. Restricción CHECK a nivel de tabla productos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_stock_entero'
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT check_stock_entero
      CHECK (
        unidad_medida NOT IN ('unidad', 'par', 'caja')
        OR (
          stock_actual = FLOOR(stock_actual)
          AND stock_minimo = FLOOR(stock_minimo)
        )
      );
  END IF;
END $$;

-- 2. Actualización de registrar_movimiento_inventario con validación de enteros
CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
  p_producto_id   uuid,
  p_tipo          public.tipo_movimiento,
  p_cantidad      numeric(10,2),
  p_motivo        text DEFAULT NULL,
  p_proveedor_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_actual    numeric(10,2);
  v_nuevo_stock     numeric(10,2);
  v_nombre_producto text;
  v_unidad_medida   public.unidad_medida;
  v_advertencia     text := NULL;
  v_nombre_prov     text := NULL;
  v_motivo_final    text := p_motivo;
BEGIN
  -- Validaciones básicas
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
  END IF;

  IF p_tipo IN ('salida', 'ajuste') AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RAISE EXCEPTION 'El motivo es obligatorio para salidas y ajustes.';
  END IF;

  -- 1. Bloquear la fila del producto (previene race conditions)
  SELECT stock_actual, nombre, unidad_medida
    INTO v_stock_actual, v_nombre_producto, v_unidad_medida
    FROM public.productos
   WHERE id = p_producto_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto con ID % no existe.', p_producto_id;
  END IF;

  -- Validación de cantidad entera para unidades no fraccionables
  IF v_unidad_medida IN ('unidad', 'par', 'caja') AND (p_cantidad != FLOOR(p_cantidad)) THEN
    RAISE EXCEPTION 'La cantidad para el producto "%" (%) debe ser un número entero sin decimales (solicitado: %).',
      v_nombre_producto, v_unidad_medida, p_cantidad;
  END IF;

  -- 2. Calcular nuevo stock
  IF p_tipo = 'entrada' THEN
    v_nuevo_stock := v_stock_actual + p_cantidad;
  ELSE
    -- salida o ajuste → resta
    v_nuevo_stock := v_stock_actual - p_cantidad;
  END IF;

  -- Advertencia si queda negativo
  IF v_nuevo_stock < 0 THEN
    v_advertencia := format(
      '⚠️ El stock de "%s" quedará en %s. Se registró el movimiento.',
      v_nombre_producto, v_nuevo_stock
    );
  END IF;

  -- 3. Si es entrada y viene proveedor, incluirlo en el motivo si no estaba presente
  IF p_tipo = 'entrada' AND p_proveedor_id IS NOT NULL THEN
    SELECT nombre INTO v_nombre_prov
      FROM public.proveedores
     WHERE id = p_proveedor_id;

    IF v_nombre_prov IS NOT NULL AND (p_motivo IS NULL OR p_motivo NOT LIKE '%Proveedor:%') THEN
      v_motivo_final := CASE
        WHEN p_motivo IS NULL OR trim(p_motivo) = '' THEN format('Proveedor: %s', v_nombre_prov)
        ELSE format('[Proveedor: %s] %s', v_nombre_prov, p_motivo)
      END;
    END IF;
  END IF;

  -- 4. Insertar movimiento de inventario
  INSERT INTO public.movimientos_inventario (
    producto_id,
    tipo,
    cantidad,
    motivo
  ) VALUES (
    p_producto_id,
    p_tipo,
    p_cantidad,
    v_motivo_final
  );

  -- 5. Actualizar stock_actual y proveedor_id atómicamente dentro de la transacción
  UPDATE public.productos
     SET stock_actual = v_nuevo_stock,
         proveedor_id = CASE
                          WHEN p_tipo = 'entrada' AND p_proveedor_id IS NOT NULL THEN p_proveedor_id
                          ELSE proveedor_id
                        END,
         updated_at = now()
   WHERE id = p_producto_id;

  -- 6. Retornar resultado
  RETURN jsonb_build_object(
    'nuevo_stock', v_nuevo_stock,
    'advertencia', v_advertencia,
    'producto_nombre', v_nombre_producto
  );
END;
$$;

-- 3. Actualización de procesar_venta_transaccion con validación de enteros
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid, text, uuid);

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
  p_origen_autorizacion     text DEFAULT 'admin_online',
  p_presupuesto_id          uuid DEFAULT NULL
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
  v_unidad_medida         public.unidad_medida;
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
  v_estado_presupuesto    public.estado_presupuesto;
  v_folio_presupuesto     text;
BEGIN
  -- 0. Idempotencia por client_tx_id (debe evaluarse primero para retornar el recibo existente en reintentos de red)
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

  -- 1. Validar presupuesto si viene suministrado (bloqueo FOR UPDATE y verificación de estado)
  IF p_presupuesto_id IS NOT NULL THEN
    SELECT estado, folio
      INTO v_estado_presupuesto, v_folio_presupuesto
      FROM public.presupuestos
     WHERE id = p_presupuesto_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El presupuesto con ID % no existe.', p_presupuesto_id;
    END IF;

    IF v_estado_presupuesto = 'convertido' THEN
      RAISE EXCEPTION 'Este presupuesto ya fue convertido en venta previamente (Folio %).', v_folio_presupuesto;
    ELSIF v_estado_presupuesto = 'cancelado' THEN
      RAISE EXCEPTION 'No se puede convertir un presupuesto cancelado (Folio %).', v_folio_presupuesto;
    ELSIF v_estado_presupuesto <> 'vigente' THEN
      RAISE EXCEPTION 'El presupuesto % no se encuentra en estado vigente (Estado actual: %).', v_folio_presupuesto, v_estado_presupuesto;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito de venta no contiene ningún producto.';
  END IF;

  -- 2. Obtener la tasa de cambio activa más reciente directamente en la BD
  SELECT tasa INTO v_tasa_real
    FROM public.tasas_cambio
   ORDER BY fecha DESC, created_at DESC
   LIMIT 1;

  IF v_tasa_real IS NULL OR v_tasa_real <= 0 THEN
    v_tasa_real := COALESCE(p_tasa_cambio_aplicada, 1);
  END IF;

  -- 3. Bloqueo FOR UPDATE, verificación de stock, validación de enteros y recálculo estricto de precios por producto
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;

    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad del producto debe ser mayor a cero.';
    END IF;

    SELECT stock_actual, nombre, precio_venta_usd, COALESCE(precio_costo_usd, 0), unidad_medida
      INTO v_stock_actual, v_nombre_producto, v_precio_venta_real, v_precio_costo_actual, v_unidad_medida
      FROM public.productos
     WHERE id = v_producto_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto con ID % no existe en el catálogo.', v_producto_id;
    END IF;

    -- Validación de cantidad entera para unidades no fraccionables ('unidad', 'par', 'caja')
    IF v_unidad_medida IN ('unidad', 'par', 'caja') AND (v_cantidad != FLOOR(v_cantidad)) THEN
      RAISE EXCEPTION 'La cantidad para el producto "%" (%) debe ser un número entero sin decimales (solicitado: %).',
        v_nombre_producto, v_unidad_medida, v_cantidad;
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

  -- 4. Calcular totales finales recalculados server-side
  v_subtotal_real := ROUND(v_subtotal_real, 2);
  v_total_real    := GREATEST(0, ROUND(v_subtotal_real - v_descuento_real, 2));
  v_total_bs_real := ROUND(v_total_real * v_tasa_real, 2);

  -- 5. Validar tolerancia entre total recalculado server-side y el enviado por la UI (0.01 USD)
  IF ABS(v_total_real - p_total_usd) > 0.01 THEN
    RAISE EXCEPTION 'El precio de uno o más productos o la tasa de cambio cambió (Total catálogo: $%, Carrito enviado: $%). Actualiza el carrito e intenta de nuevo.',
      v_total_real, p_total_usd;
  END IF;

  -- 6. Recalcular el porcentaje real de descuento server-side
  IF v_subtotal_real > 0 THEN
    v_porcentaje_descuento := ROUND((v_descuento_real / v_subtotal_real) * 100.0, 2);
  ELSE
    v_porcentaje_descuento := 0;
  END IF;

  -- 7. Construir motivos de autorización requeridos
  IF v_stock_insuficiente OR p_permitir_stock_negativo THEN
    v_motivos_autorizacion := array_append(v_motivos_autorizacion, 'stock_negativo');
    v_requiere_autorizacion := true;
  END IF;

  IF v_porcentaje_descuento > 5.0 THEN
    v_motivos_autorizacion := array_append(v_motivos_autorizacion, 'descuento_excedido');
    v_requiere_autorizacion := true;
  END IF;

  -- 8. Validar si requiere autorización de Administrador
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

  -- 9. Bloqueo FOR UPDATE del cliente si es crédito / fiado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    SELECT saldo_fiado INTO v_saldo_actual
      FROM public.clientes
     WHERE id = p_cliente_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El cliente con ID % no existe.', p_cliente_id;
    END IF;
  END IF;

  -- 10. Insertar cabecera de la venta
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

  -- 11. Insertar líneas de detalle y descontar stock
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
        WHEN p_presupuesto_id IS NOT NULL THEN 'Venta generada desde Presupuesto ' || COALESCE(v_folio_presupuesto, '')
        ELSE 'Venta en POS'
      END,
      v_venta_id
    );
  END LOOP;

  -- 12. Si es fiado / crédito, incrementar saldo_fiado
  IF p_metodo_pago = 'fiado' AND p_cliente_id IS NOT NULL THEN
    UPDATE public.clientes
       SET saldo_fiado = saldo_fiado + v_total_real,
           updated_at = now()
     WHERE id = p_cliente_id;
  END IF;

  -- 13. Si se convirtió un presupuesto, actualizarlo en la misma transacción atómica
  IF p_presupuesto_id IS NOT NULL THEN
    UPDATE public.presupuestos
       SET estado = 'convertido',
           venta_id = v_venta_id,
           updated_at = now()
     WHERE id = p_presupuesto_id;
  END IF;

  -- 14. Retornar resultado
  RETURN jsonb_build_object(
    'venta_id', v_venta_id,
    'fecha', v_fecha_venta,
    'total_usd', v_total_real,
    'total_bs', v_total_bs_real,
    'tasa_cambio_aplicada', v_tasa_real,
    'motivos_autorizacion', v_motivos_autorizacion,
    'presupuesto_id', p_presupuesto_id,
    'folio_presupuesto', v_folio_presupuesto
  );
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_inventario(uuid, public.tipo_movimiento, numeric, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid, text, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
