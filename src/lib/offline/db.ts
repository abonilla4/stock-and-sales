import Dexie, { type EntityTable } from "dexie";
import type { MetodoPago, UnidadMedida } from "@/lib/types/database";

export interface LocalProducto {
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
  updated_at?: string;
}

export interface LocalCliente {
  id: string;
  nombre: string;
  telefono: string | null;
  identificacion: string | null;
  saldo_fiado: number;
  notas: string | null;
}

export interface LocalTasaCambio {
  id: string;
  fecha: string;
  tasa: number;
  fuente: string;
}

export interface ItemVentaOffline {
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
}

export interface VentaOffline {
  id?: number;
  client_tx_id: string;
  cliente_id: string | null;
  fecha: string;
  subtotal_usd: number;
  descuento_usd: number;
  total_usd: number;
  total_bs: number;
  tasa_cambio_aplicada: number;
  metodo_pago: MetodoPago;
  items: ItemVentaOffline[];
  estado_sync: "pendiente" | "sincronizando" | "error" | "sincronizado";
  error_mensaje?: string;
  created_at: string;
}

export interface RegistroAuditoria {
  id?: number;
  fecha: string;
  accion: string;
  detalle: string;
  client_tx_id?: string;
  sincronizado: boolean;
}

export class StockSalesDatabase extends Dexie {
  productos!: EntityTable<LocalProducto, "id">;
  clientes!: EntityTable<LocalCliente, "id">;
  tasas_cambio!: EntityTable<LocalTasaCambio, "id">;
  cola_ventas!: EntityTable<VentaOffline, "id">;
  registro_auditoria!: EntityTable<RegistroAuditoria, "id">;

  constructor() {
    super("StockSalesOfflineDB");

    this.version(1).stores({
      productos: "id, sku, codigo_barras, nombre, activo",
      clientes: "id, nombre, identificacion",
      tasas_cambio: "id, fecha",
      cola_ventas: "++id, client_tx_id, cliente_id, estado_sync, fecha",
      registro_auditoria: "++id, fecha, accion, client_tx_id",
    });
  }
}

export const db = new StockSalesDatabase();
