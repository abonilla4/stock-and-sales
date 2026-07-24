import { db, type LocalProducto, type LocalCliente, type LocalTasaCambio } from "./db";
import type { Producto, Cliente } from "@/lib/types/database";

/**
 * Guarda o actualiza la lista de productos descargada de Supabase en IndexedDB.
 */
export async function cachearProductosLocales(productos: Producto[]) {
  if (!productos || productos.length === 0) return;
  try {
    const localProds: LocalProducto[] = productos.map((p) => ({
      id: p.id,
      sku: p.sku,
      codigo_barras: p.codigo_barras || null,
      nombre: p.nombre,
      descripcion: p.descripcion || null,
      categoria_id: p.categoria_id,
      proveedor_id: p.proveedor_id || null,
      unidad_medida: p.unidad_medida,
      precio_costo_usd: Number(p.precio_costo_usd),
      precio_venta_usd: Number(p.precio_venta_usd),
      stock_actual: Number(p.stock_actual),
      stock_minimo: Number(p.stock_minimo),
      activo: p.activo,
      updated_at: p.updated_at,
    }));

    await db.productos.bulkPut(localProds);
  } catch (error) {
    console.error("Error al cachear productos localmente en IndexedDB:", error);
  }
}

/**
 * Guarda o actualiza la lista de clientes en IndexedDB.
 */
export async function cachearClientesLocales(clientes: Cliente[]) {
  if (!clientes || clientes.length === 0) return;
  try {
    const localClientes: LocalCliente[] = clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono || null,
      identificacion: c.identificacion || null,
      saldo_fiado: Number(c.saldo_fiado || 0),
      notas: c.notas || null,
    }));

    await db.clientes.bulkPut(localClientes);
  } catch (error) {
    console.error("Error al cachear clientes localmente en IndexedDB:", error);
  }
}

/**
 * Guarda la tasa de cambio activa en IndexedDB.
 */
export async function cachearTasaActivaLocal(tasaData: { id?: string; tasa: number; fecha?: string | null }) {
  if (!tasaData || !tasaData.tasa) return;
  try {
    const localTasa: LocalTasaCambio = {
      id: tasaData.id || "tasa-activa",
      tasa: Number(tasaData.tasa),
      fecha: tasaData.fecha || new Date().toISOString(),
      fuente: "manual",
    };

    await db.tasas_cambio.put(localTasa);
  } catch (error) {
    console.error("Error al cachear tasa de cambio localmente:", error);
  }
}

/**
 * Busca productos localmente en IndexedDB por Nombre, SKU o Código de Barras.
 */
export async function buscarProductosOffline(query: string = ""): Promise<Producto[]> {
  try {
    const cleanQuery = query.trim().toLowerCase();

    const todos = await db.productos.filter((p) => p.activo).toArray();

    if (!cleanQuery) {
      return todos.slice(0, 30) as unknown as Producto[];
    }

    const filtrados = todos.filter((p) => {
      const matchNombre = p.nombre.toLowerCase().includes(cleanQuery);
      const matchSku = p.sku.toLowerCase().includes(cleanQuery);
      const matchCodigo = p.codigo_barras ? p.codigo_barras.toLowerCase().includes(cleanQuery) : false;
      return matchNombre || matchSku || matchCodigo;
    });

    return filtrados.slice(0, 30) as unknown as Producto[];
  } catch (error) {
    console.error("Error al buscar productos offline:", error);
    return [];
  }
}

/**
 * Obtiene la lista de clientes almacenados localmente en IndexedDB.
 */
export async function obtenerClientesOffline(): Promise<Cliente[]> {
  try {
    const clientes = await db.clientes.toArray();
    return clientes as unknown as Cliente[];
  } catch (error) {
    console.error("Error al obtener clientes offline:", error);
    return [];
  }
}

/**
 * Obtiene la tasa activa almacenada localmente.
 */
export async function obtenerTasaOffline(): Promise<{ tasa: number; fecha: string | null } | null> {
  try {
    const tasas = await db.tasas_cambio.toArray();
    if (tasas.length === 0) return null;
    // Retornar la última guardada
    const ultima = tasas[tasas.length - 1];
    return { tasa: ultima.tasa, fecha: ultima.fecha };
  } catch (error) {
    console.error("Error al obtener tasa offline:", error);
    return null;
  }
}
