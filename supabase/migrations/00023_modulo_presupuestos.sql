-- ============================================================
-- Migración 00023: Módulo de Presupuestos (NÚCLEO)
-- 1. Tipos ENUM moneda_presupuesto y estado_presupuesto
-- 2. Secuencia de folios presupuestos_folio_seq (COT-0001)
-- 3. Tablas presupuestos y detalle_presupuesto con RLS
-- 4. Candado estructural REVOKE UPDATE (estado, venta_id)
-- 5. RPC cancelar_presupuesto_rpc (SECURITY DEFINER)
-- 6. Actualización de procesar_venta_transaccion con p_presupuesto_id
-- ============================================================

-- 1. Tipos ENUM
DO $$ BEGIN
  CREATE TYPE public.moneda_presupuesto AS ENUM ('usd', 'bs');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_presupuesto AS ENUM ('vigente', 'convertido', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Secuencia para folios correlativos
CREATE SEQUENCE IF NOT EXISTS public.presupuestos_folio_seq START WITH 1;

-- 3. Tablas
CREATE TABLE IF NOT EXISTS public.presupuestos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio                   text UNIQUE NOT NULL DEFAULT ('COT-' || LPAD(nextval('public.presupuestos_folio_seq')::text, 4, '0')),
  cliente_id              uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  usuario_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_creacion          timestamptz NOT NULL DEFAULT now(),
  fecha_vigencia          timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  moneda_mostrada         public.moneda_presupuesto NOT NULL DEFAULT 'usd',
  subtotal_usd            numeric(10,2) NOT NULL DEFAULT 0,
  descuento_usd           numeric(10,2) NOT NULL DEFAULT 0,
  total_usd               numeric(10,2) NOT NULL DEFAULT 0,
  tasa_cambio_referencia  numeric(10,4),
  total_bs_referencia     numeric(12,2),
  estado                  public.estado_presupuesto NOT NULL DEFAULT 'vigente',
  venta_id                uuid REFERENCES public.ventas(id) ON DELETE SET NULL,
  notas                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.detalle_presupuesto (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id                  uuid NOT NULL REFERENCES public.presupuestos(id) ON DELETE CASCADE,
  producto_id                     uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad                        numeric(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario_usd_referencia  numeric(10,2) NOT NULL CHECK (precio_unitario_usd_referencia >= 0),
  subtotal_usd                    numeric(10,2) NOT NULL CHECK (subtotal_usd >= 0),
  created_at                      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente_id ON public.presupuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON public.presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_presupuestos_fecha_creacion ON public.presupuestos(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_presupuestos_venta_id ON public.presupuestos(venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_presupuesto_presupuesto_id ON public.detalle_presupuesto(presupuesto_id);

-- RLS Habilitado
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_presupuesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select presupuestos"
  ON public.presupuestos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert presupuestos"
  ON public.presupuestos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update presupuestos"
  ON public.presupuestos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete presupuestos"
  ON public.presupuestos FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can select detalle_presupuesto"
  ON public.detalle_presupuesto FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert detalle_presupuesto"
  ON public.detalle_presupuesto FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update detalle_presupuesto"
  ON public.detalle_presupuesto FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete detalle_presupuesto"
  ON public.detalle_presupuesto FOR DELETE USING (auth.uid() IS NOT NULL);

-- 4. Candado Estructural: Proteger columnas críticas (estado, venta_id, folio, montos)
REVOKE UPDATE ON public.presupuestos FROM authenticated, anon, public;
REVOKE UPDATE ON public.detalle_presupuesto FROM authenticated, anon, public;

GRANT UPDATE (
  cliente_id,
  fecha_vigencia,
  moneda_mostrada,
  notas,
  updated_at
) ON public.presupuestos TO authenticated;

-- 5. RPC para cancelar presupuesto de forma segura (SECURITY DEFINER)
-- Aplica la guarda atómica WHERE id = p_presupuesto_id AND estado = 'vigente' en el UPDATE
CREATE OR REPLACE FUNCTION public.cancelar_presupuesto_rpc(
  p_presupuesto_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estado_actual public.estado_presupuesto;
  v_folio         text;
BEGIN
  IF p_presupuesto_id IS NULL THEN
    RAISE EXCEPTION 'El ID del presupuesto es obligatorio.';
  END IF;

  -- UPDATE atómico condicional: solo muta si el estado es exactamente 'vigente'
  UPDATE public.presupuestos
     SET estado = 'cancelado',
         updated_at = now()
   WHERE id = p_presupuesto_id
     AND estado = 'vigente'
  RETURNING folio INTO v_folio;

  -- Si ninguna fila fue afectada, diagnosticar la causa exacta para mensaje claro
  IF NOT FOUND THEN
    SELECT estado, folio INTO v_estado_actual, v_folio
      FROM public.presupuestos
     WHERE id = p_presupuesto_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El presupuesto con ID % no existe.', p_presupuesto_id;
    ELSIF v_estado_actual = 'convertido' THEN
      RAISE EXCEPTION 'No se puede cancelar un presupuesto que ya fue convertido en venta (Folio %).', v_folio;
    ELSIF v_estado_actual = 'cancelado' THEN
      RAISE EXCEPTION 'El presupuesto ya se encuentra cancelado (Folio %).', v_folio;
    ELSE
      RAISE EXCEPTION 'Solo se pueden cancelar presupuestos en estado vigente (Estado actual: %, Folio: %).', v_estado_actual, v_folio;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'presupuesto_id', p_presupuesto_id,
    'folio', v_folio,
    'estado', 'cancelado'
  );
END;
$$;

-- 6. Actualización de procesar_venta_transaccion con soporte para p_presupuesto_id
DROP FUNCTION IF EXISTS public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid, text);
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

  -- 3. Bloqueo FOR UPDATE, verificación de stock y recálculo estricto de precios por producto
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad    := (v_item->>'cantidad')::numeric;

    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad del producto debe ser mayor a cero.';
    END IF;

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
GRANT EXECUTE ON FUNCTION public.cancelar_presupuesto_rpc(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.procesar_venta_transaccion(uuid, numeric, numeric, numeric, numeric, numeric, public.metodo_pago, jsonb, boolean, uuid, uuid, text, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
