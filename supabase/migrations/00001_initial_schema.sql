-- ============================================================
-- Migración 00001: Esquema inicial — Stock&Sales
-- Sigue exactamente 05-Esquema-Backend.md
-- ============================================================

-- =========================
-- ENUMS
-- =========================

CREATE TYPE unidad_medida AS ENUM (
  'unidad', 'caja', 'metro', 'kilo', 'litro', 'par'
);

CREATE TYPE tipo_movimiento AS ENUM (
  'entrada', 'salida', 'ajuste', 'venta'
);

CREATE TYPE metodo_pago AS ENUM (
  'efectivo_usd', 'efectivo_bs', 'pago_movil', 'transferencia', 'tarjeta', 'fiado'
);

CREATE TYPE estado_venta AS ENUM (
  'completada', 'anulada'
);

CREATE TYPE fuente_tasa AS ENUM (
  'manual', 'api'
);

CREATE TYPE rol_usuario AS ENUM (
  'admin', 'cajero'
);

-- =========================
-- TABLAS
-- =========================

-- Profiles (vinculada a auth.users, §5 del esquema)
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        rol_usuario NOT NULL DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Categorías
CREATE TABLE categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Proveedores
CREATE TABLE proveedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  telefono    text,
  contacto    text,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Productos
CREATE TABLE productos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku               text UNIQUE NOT NULL,
  codigo_barras     text,
  nombre            text NOT NULL,
  descripcion       text,
  categoria_id      uuid REFERENCES categorias(id),
  proveedor_id      uuid REFERENCES proveedores(id),
  unidad_medida     unidad_medida NOT NULL DEFAULT 'unidad',
  precio_costo_usd  numeric(10,2) NOT NULL,
  precio_venta_usd  numeric(10,2) NOT NULL,
  stock_actual      numeric(10,2) NOT NULL DEFAULT 0,
  stock_minimo      numeric(10,2) NOT NULL DEFAULT 0,
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  telefono        text,
  identificacion  text,
  saldo_fiado     numeric(10,2) NOT NULL DEFAULT 0,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Tasas de cambio (append-only, §2 tasas_cambio)
CREATE TABLE tasas_cambio (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha       timestamptz NOT NULL DEFAULT now(),
  tasa        numeric(10,4) NOT NULL,
  fuente      fuente_tasa NOT NULL DEFAULT 'manual',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Ventas
CREATE TABLE ventas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid REFERENCES clientes(id),
  fecha                 timestamptz NOT NULL DEFAULT now(),
  subtotal_usd          numeric(10,2) NOT NULL,
  descuento_usd         numeric(10,2) NOT NULL DEFAULT 0,
  total_usd             numeric(10,2) NOT NULL,
  tasa_cambio_aplicada  numeric(10,4) NOT NULL,
  total_bs              numeric(12,2) NOT NULL,
  metodo_pago           metodo_pago NOT NULL,
  estado                estado_venta NOT NULL DEFAULT 'completada',
  sincronizado          boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Detalle de venta (precio congelado al momento de la venta)
CREATE TABLE detalle_venta (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id            uuid NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id         uuid NOT NULL REFERENCES productos(id),
  cantidad            numeric(10,2) NOT NULL,
  precio_unitario_usd numeric(10,2) NOT NULL,
  subtotal_usd        numeric(10,2) NOT NULL
);

-- Movimientos de inventario
CREATE TABLE movimientos_inventario (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id         uuid NOT NULL REFERENCES productos(id),
  tipo                tipo_movimiento NOT NULL,
  cantidad            numeric(10,2) NOT NULL,
  motivo              text,
  referencia_venta_id uuid REFERENCES ventas(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Pagos de fiado
CREATE TABLE pagos_fiado (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES clientes(id),
  venta_id      uuid REFERENCES ventas(id),
  monto_usd     numeric(10,2) NOT NULL,
  monto_bs      numeric(12,2),
  metodo_pago   metodo_pago NOT NULL,
  fecha         timestamptz NOT NULL DEFAULT now(),
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
