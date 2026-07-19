-- ============================================================
-- Migración 00003: Índices recomendados — Stock&Sales
-- Según 05-Esquema-Backend.md §4
-- ============================================================

-- Búsqueda en POS por SKU
CREATE INDEX idx_productos_sku ON productos(sku);

-- Búsqueda en POS por código de barras
CREATE INDEX idx_productos_codigo_barras ON productos(codigo_barras);

-- Reportes por rango de fecha
CREATE INDEX idx_ventas_fecha ON ventas(fecha);

-- Búsqueda de clientes por identificación
CREATE INDEX idx_clientes_identificacion ON clientes(identificacion);

-- Historial de movimientos por producto y fecha
CREATE INDEX idx_movimientos_producto_fecha ON movimientos_inventario(producto_id, created_at);
