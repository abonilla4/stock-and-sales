-- ============================================================
-- Migración 00002: Row Level Security — Stock&Sales
-- RLS habilitado en TODAS las tablas desde el primer commit.
-- v1 (usuario único): cualquier usuario autenticado puede leer/escribir.
-- ============================================================

-- =========================
-- HABILITAR RLS
-- =========================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasas_cambio ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_fiado ENABLE ROW LEVEL SECURITY;

-- =========================
-- POLÍTICAS — profiles (solo su propio perfil)
-- =========================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- INSERT se maneja por el trigger (00004), no se necesita política de INSERT
-- para el usuario final.

-- =========================
-- POLÍTICAS — tablas de negocio (usuario autenticado)
-- =========================

-- Macro: para cada tabla de negocio, permitir SELECT/INSERT/UPDATE/DELETE
-- a cualquier usuario autenticado (v1: solo existe un usuario).

-- categorias
CREATE POLICY "Authenticated users can select categorias"
  ON categorias FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert categorias"
  ON categorias FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update categorias"
  ON categorias FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete categorias"
  ON categorias FOR DELETE USING (auth.uid() IS NOT NULL);

-- proveedores
CREATE POLICY "Authenticated users can select proveedores"
  ON proveedores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert proveedores"
  ON proveedores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update proveedores"
  ON proveedores FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete proveedores"
  ON proveedores FOR DELETE USING (auth.uid() IS NOT NULL);

-- productos
CREATE POLICY "Authenticated users can select productos"
  ON productos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert productos"
  ON productos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update productos"
  ON productos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete productos"
  ON productos FOR DELETE USING (auth.uid() IS NOT NULL);

-- clientes
CREATE POLICY "Authenticated users can select clientes"
  ON clientes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert clientes"
  ON clientes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update clientes"
  ON clientes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete clientes"
  ON clientes FOR DELETE USING (auth.uid() IS NOT NULL);

-- tasas_cambio (append-only en lógica de app, pero la BD permite UPDATE por si acaso)
CREATE POLICY "Authenticated users can select tasas_cambio"
  ON tasas_cambio FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert tasas_cambio"
  ON tasas_cambio FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update tasas_cambio"
  ON tasas_cambio FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete tasas_cambio"
  ON tasas_cambio FOR DELETE USING (auth.uid() IS NOT NULL);

-- ventas
CREATE POLICY "Authenticated users can select ventas"
  ON ventas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert ventas"
  ON ventas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update ventas"
  ON ventas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete ventas"
  ON ventas FOR DELETE USING (auth.uid() IS NOT NULL);

-- detalle_venta
CREATE POLICY "Authenticated users can select detalle_venta"
  ON detalle_venta FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert detalle_venta"
  ON detalle_venta FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update detalle_venta"
  ON detalle_venta FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete detalle_venta"
  ON detalle_venta FOR DELETE USING (auth.uid() IS NOT NULL);

-- movimientos_inventario
CREATE POLICY "Authenticated users can select movimientos_inventario"
  ON movimientos_inventario FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert movimientos_inventario"
  ON movimientos_inventario FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update movimientos_inventario"
  ON movimientos_inventario FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete movimientos_inventario"
  ON movimientos_inventario FOR DELETE USING (auth.uid() IS NOT NULL);

-- pagos_fiado
CREATE POLICY "Authenticated users can select pagos_fiado"
  ON pagos_fiado FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert pagos_fiado"
  ON pagos_fiado FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update pagos_fiado"
  ON pagos_fiado FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete pagos_fiado"
  ON pagos_fiado FOR DELETE USING (auth.uid() IS NOT NULL);
