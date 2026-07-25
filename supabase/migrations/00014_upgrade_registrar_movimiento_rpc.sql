-- ============================================================
-- Migración 00014: Actualización de RPC registrar_movimiento_inventario
-- Mueve la actualización de proveedor_id dentro de la transacción atómica de la RPC
-- ============================================================

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
  SELECT stock_actual, nombre
    INTO v_stock_actual, v_nombre_producto
    FROM public.productos
   WHERE id = p_producto_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto con ID % no existe.', p_producto_id;
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
