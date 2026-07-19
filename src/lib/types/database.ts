// =============================================================
// Tipos TypeScript del esquema de BD — Stock&Sales
// Generados manualmente a partir de 05-Esquema-Backend.md
// En el futuro se pueden autogenerar con: npx supabase gen types
// =============================================================

// ---- Enums ----

export type UnidadMedida = "unidad" | "caja" | "metro" | "kilo" | "litro" | "par";

export type TipoMovimiento = "entrada" | "salida" | "ajuste" | "venta";

export type MetodoPago =
  | "efectivo_usd"
  | "efectivo_bs"
  | "pago_movil"
  | "transferencia"
  | "tarjeta"
  | "fiado";

export type EstadoVenta = "completada" | "anulada";

export type FuenteTasa = "manual" | "api";

export type RolUsuario = "admin" | "cajero";

// ---- Tablas ----

export interface Profile {
  id: string;
  role: RolUsuario;
  created_at: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  contacto: string | null;
  notas: string | null;
  created_at: string;
}

export interface Producto {
  id: string;
  sku: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  proveedor_id: string | null;
  unidad_medida: UnidadMedida;
  precio_costo_usd: number;
  precio_venta_usd: number;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  identificacion: string | null;
  saldo_fiado: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TasaCambio {
  id: string;
  fecha: string;
  tasa: number;
  fuente: FuenteTasa;
  created_at: string;
}

export interface Venta {
  id: string;
  cliente_id: string | null;
  fecha: string;
  subtotal_usd: number;
  descuento_usd: number;
  total_usd: number;
  tasa_cambio_aplicada: number;
  total_bs: number;
  metodo_pago: MetodoPago;
  estado: EstadoVenta;
  sincronizado: boolean;
  created_at: string;
}

export interface DetalleVenta {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
}

export interface MovimientoInventario {
  id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo: string | null;
  referencia_venta_id: string | null;
  created_at: string;
}

export interface PagoFiado {
  id: string;
  cliente_id: string;
  venta_id: string | null;
  monto_usd: number;
  monto_bs: number | null;
  metodo_pago: MetodoPago;
  fecha: string;
  notas: string | null;
  created_at: string;
}
