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

/**
 * Cómo se autorizó una venta de excepción.
 * `offline_diferido` deja `autorizado_por` en NULL: no había administrador en
 * el momento, por eso esas ventas requieren revisión a posteriori.
 */
export type OrigenAutorizacion = "admin_online" | "offline_diferido";

/** Dictamen de la revisión de una venta autorizada offline (migración 00029). */
export type ResultadoRevision = "confirmada" | "irregular";

// Orden del enum en BD (mayor a menor privilegio): desarrollador < admin < cajero.
// 'desarrollador' se agregó en la migración 00025 y solo se asigna por SQL manual.
export type RolUsuario = "desarrollador" | "admin" | "cajero";

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
  codigo?: string | null;
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
  // Trazabilidad de autorización de excepciones (migraciones 00010, 00011, 00016).
  client_tx_id: string | null;
  autorizado_por: string | null;
  autorizado_en: string | null;
  origen_autorizacion: OrigenAutorizacion | null;
  motivos_autorizacion: string[] | null;
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

export type MonedaPresupuesto = "usd" | "bs";

export type EstadoPresupuesto = "vigente" | "convertido" | "cancelado";

export interface Presupuesto {
  id: string;
  folio: string;
  cliente_id: string | null;
  usuario_id: string | null;
  fecha_creacion: string;
  fecha_vigencia: string;
  moneda_mostrada: MonedaPresupuesto;
  subtotal_usd: number;
  descuento_usd: number;
  total_usd: number;
  tasa_cambio_referencia: number | null;
  total_bs_referencia: number | null;
  estado: EstadoPresupuesto;
  venta_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cliente?: Cliente | null;
}

export interface DetallePresupuesto {
  id: string;
  presupuesto_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario_usd_referencia: number;
  subtotal_usd: number;
  created_at: string;
  producto?: Producto;
}

// ---- Permisos y auditoría (migraciones 00026-00028) ----

/**
 * Catálogo fijo de permisos. Solo cambia por migración, nunca desde la app.
 * `es_critico` indica que la RPC asignar_permiso restringe a qué roles puede
 * otorgarse; el kernel de esa RPC es la autoridad, no este campo.
 */
export interface Permiso {
  codigo: string;
  descripcion: string;
  grupo: string;
  es_critico: boolean;
  orden: number;
}

/** Permisos efectivos por rol. Solo modificable vía RPC asignar_permiso. */
export interface RolPermiso {
  rol: RolUsuario;
  permiso_codigo: string;
  created_at: string;
}

/**
 * Registro de auditoría del servidor (tabla `registro_auditoria`).
 * No confundir con el log local de Dexie en `lib/offline/db.ts`, que tiene
 * otra forma y solo vive en el navegador.
 */
export interface RegistroAuditoria {
  id: string;
  usuario_id: string | null;
  email: string | null;
  accion: string;
  exito: boolean;
  detalle: string | null;
  created_at: string;
}

/**
 * Revisión a posteriori de una venta autorizada offline (migración 00029).
 * Vive aparte de `ventas` a propósito: la venta es un snapshot inmutable y la
 * revisión es un hecho posterior sobre ella, no una corrección.
 * Solo se escribe vía RPC `revisar_autorizacion_offline`.
 */
export interface RevisionAutorizacion {
  id: string;
  venta_id: string;
  revisado_por: string;
  resultado: ResultadoRevision;
  notas: string | null;
  created_at: string;
}


/**
 * Fila devuelta por la RPC listar_usuarios (migración 00031).
 * No es una tabla: es la proyección estrecha de profiles + auth.users que el
 * panel necesita. `auth.users` nunca se lee directo desde la aplicación.
 */
export interface UsuarioListado {
  id: string;
  email: string;
  role: RolUsuario;
  created_at: string;
  last_sign_in_at: string | null;
  /** Fecha futura = cuenta desactivada. Supabase Auth no tiene flag booleano. */
  banned_until: string | null;
}
