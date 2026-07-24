-- ============================================================
-- Migración 00008: Función RPC atómica para registrar movimientos de inventario
-- Garantiza que el ajuste de stock_actual SIEMPRE ocurra dentro de una
-- transacción atómica con bloqueo FOR UPDATE, nunca como SELECT + UPDATE
-- dispersos desde el servidor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
  p_producto_id   uuid,
  p_tipo          public.tipo_movimiento,
  p_cantidad      numeric(10,2),
  p_motivo        text DEFAULT NULL
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

  -- Advertencia si queda negativo (no bloquea, per 03-Flujo-App.md §8)
  IF v_nuevo_stock < 0 THEN
    v_advertencia := format(
      '⚠️ El stock de "%s" quedará en %s. Se registró el movimiento.',
      v_nombre_producto, v_nuevo_stock
    );
  END IF;

  -- 3. Insertar movimiento de inventario
  INSERT INTO public.movimientos_inventario (
    producto_id,
    tipo,
    cantidad,
    motivo
  ) VALUES (
    p_producto_id,
    p_tipo,
    p_cantidad,
    p_motivo
  );

  -- 4. Actualizar stock_actual atómicamente
  UPDATE public.productos
     SET stock_actual = v_nuevo_stock,
         updated_at = now()
   WHERE id = p_producto_id;

  -- 5. Retornar resultado
  RETURN jsonb_build_object(
    'nuevo_stock', v_nuevo_stock,
    'advertencia', v_advertencia,
    'producto_nombre', v_nombre_producto
  );
END;
$$;
