"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  crearPresupuestoSchema,
  getZodErrorMessage,
} from "@/lib/schemas/actions-schemas";
import type {
  Presupuesto,
  DetallePresupuesto,
  Producto,
  MonedaPresupuesto,
  EstadoPresupuesto,
} from "@/lib/types/database";

export interface ItemPresupuestoInput {
  producto_id: string;
  cantidad: number;
}

export interface CrearPresupuestoParams {
  cliente_id?: string | null;
  descuento_usd?: number;
  moneda_mostrada?: MonedaPresupuesto;
  notas?: string | null;
  items: ItemPresupuestoInput[];
}

export interface PresupuestoConEstadoExtendido extends Presupuesto {
  es_vencido: boolean;
  total_items?: number;
}

export interface DetallePresupuestoCompleto extends PresupuestoConEstadoExtendido {
  detalles: (DetallePresupuesto & {
    producto: Producto;
    precio_actual_cambio?: boolean;
    stock_insuficiente?: boolean;
  })[];
}

/**
 * Crear un nuevo presupuesto (cotización informativa).
 *
 * Los precios se obtienen obligatoriamente del catálogo server-side (productos.precio_venta_usd).
 * NO reserva ni descuenta stock — nada se compromete hasta la conversión real.
 */
export async function crearPresupuesto(params: CrearPresupuestoParams) {
  const parseResult = crearPresupuestoSchema.safeParse(params);
  if (!parseResult.success) {
    return { error: getZodErrorMessage(parseResult.error) };
  }

  const { cliente_id, descuento_usd, moneda_mostrada, notas, items } = parseResult.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  // 1. Obtener la tasa de cambio activa más reciente
  const { data: tasaData } = await supabase
    .from("tasas_cambio")
    .select("tasa")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const tasaReferencia = tasaData?.tasa ?? 1;

  // 2. Obtener los IDs únicos de productos solicitados
  const productIds = Array.from(new Set(items.map((i) => i.producto_id)));

  const { data: productos, error: prodError } = await supabase
    .from("productos")
    .select("id, nombre, precio_venta_usd, activo")
    .in("id", productIds);

  if (prodError || !productos || productos.length === 0) {
    return { error: "Error al consultar los productos en el catálogo." };
  }

  const productosMap = new Map<string, { nombre: string; precio_venta_usd: number; activo: boolean }>();
  productos.forEach((p) => {
    productosMap.set(p.id, {
      nombre: p.nombre,
      precio_venta_usd: Number(p.precio_venta_usd),
      activo: p.activo,
    });
  });

  // 3. Validar productos y calcular subtotales server-side
  let subtotalUsd = 0;
  const lineasDetalle: {
    producto_id: string;
    cantidad: number;
    precio_unitario_usd_referencia: number;
    subtotal_usd: number;
  }[] = [];

  for (const item of items) {
    const prod = productosMap.get(item.producto_id);
    if (!prod) {
      return { error: `Uno de los productos seleccionados no existe en el catálogo.` };
    }

    const cantidad = Number(item.cantidad);
    const precioUnitario = prod.precio_venta_usd;
    const subtotalLinea = Math.round(cantidad * precioUnitario * 100) / 100;

    subtotalUsd += subtotalLinea;
    lineasDetalle.push({
      producto_id: item.producto_id,
      cantidad,
      precio_unitario_usd_referencia: precioUnitario,
      subtotal_usd: subtotalLinea,
    });
  }

  subtotalUsd = Math.round(subtotalUsd * 100) / 100;
  const descuentoReal = Math.min(subtotalUsd, Math.round((descuento_usd ?? 0) * 100) / 100);
  const totalUsd = Math.max(0, Math.round((subtotalUsd - descuentoReal) * 100) / 100);
  const totalBsReferencia = Math.round(totalUsd * tasaReferencia * 100) / 100;

  // 4. Insertar cabecera del presupuesto
  const { data: nuevoPresupuesto, error: insertPresupuestoError } = await supabase
    .from("presupuestos")
    .insert({
      cliente_id: cliente_id ?? null,
      usuario_id: user.id,
      moneda_mostrada,
      subtotal_usd: subtotalUsd,
      descuento_usd: descuentoReal,
      total_usd: totalUsd,
      tasa_cambio_referencia: tasaReferencia,
      total_bs_referencia: totalBsReferencia,
      estado: "vigente",
      notas: notas ?? null,
    })
    .select("id, folio, fecha_creacion, fecha_vigencia")
    .single();

  if (insertPresupuestoError || !nuevoPresupuesto) {
    console.error("Error al crear presupuesto:", insertPresupuestoError);
    return { error: `Error al crear presupuesto: ${insertPresupuestoError?.message}` };
  }

  // 5. Insertar líneas de detalle asociadas
  const filasDetalle = lineasDetalle.map((l) => ({
    presupuesto_id: nuevoPresupuesto.id,
    producto_id: l.producto_id,
    cantidad: l.cantidad,
    precio_unitario_usd_referencia: l.precio_unitario_usd_referencia,
    subtotal_usd: l.subtotal_usd,
  }));

  const { error: insertDetalleError } = await supabase
    .from("detalle_presupuesto")
    .insert(filasDetalle);

  if (insertDetalleError) {
    console.error("Error al insertar detalles de presupuesto:", insertDetalleError);
    // Limpieza en caso de error parcial
    await supabase.from("presupuestos").delete().eq("id", nuevoPresupuesto.id);
    return { error: `Error al guardar los productos del presupuesto: ${insertDetalleError.message}` };
  }

  revalidatePath("/dashboard/presupuestos");
  revalidatePath("/dashboard");

  return {
    success: true,
    presupuestoId: nuevoPresupuesto.id,
    folio: nuevoPresupuesto.folio,
  };
}

/**
 * Obtener lista de presupuestos con cálculo dinámico de vencimiento y filtros opcionales.
 */
export async function obtenerPresupuestos(filtros?: {
  estado?: "todos" | EstadoPresupuesto | "vencido";
  busqueda?: string;
}): Promise<PresupuestoConEstadoExtendido[]> {
  const supabase = await createClient();

  let query = supabase
    .from("presupuestos")
    .select(
      `
      *,
      cliente:clientes(id, nombre, identificacion, telefono),
      detalle_presupuesto(id)
    `
    )
    .order("fecha_creacion", { ascending: false });

  const cleanBusqueda = filtros?.busqueda?.trim();
  if (cleanBusqueda) {
    query = query.or(
      `folio.ilike.%${cleanBusqueda}%,notas.ilike.%${cleanBusqueda}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener presupuestos:", error);
    return [];
  }

  const now = new Date().getTime();

  const presupuestosExt: PresupuestoConEstadoExtendido[] = (data ?? []).map((row: any) => {
    const fechaVigenciaMs = new Date(row.fecha_vigencia).getTime();
    const esVencido = row.estado === "vigente" && fechaVigenciaMs < now;

    return {
      ...row,
      subtotal_usd: Number(row.subtotal_usd),
      descuento_usd: Number(row.descuento_usd),
      total_usd: Number(row.total_usd),
      tasa_cambio_referencia: row.tasa_cambio_referencia ? Number(row.tasa_cambio_referencia) : null,
      total_bs_referencia: row.total_bs_referencia ? Number(row.total_bs_referencia) : null,
      es_vencido: esVencido,
      total_items: Array.isArray(row.detalle_presupuesto) ? row.detalle_presupuesto.length : 0,
    };
  });

  // Filtrado en memoria por estado si se solicitó
  if (filtros?.estado && filtros.estado !== "todos") {
    if (filtros.estado === "vencido") {
      return presupuestosExt.filter((p) => p.es_vencido);
    }
    if (filtros.estado === "vigente") {
      return presupuestosExt.filter((p) => p.estado === "vigente" && !p.es_vencido);
    }
    return presupuestosExt.filter((p) => p.estado === filtros.estado);
  }

  return presupuestosExt;
}

/**
 * Obtener detalle completo de un presupuesto por ID, incluyendo estado actual de catálogo y stock.
 */
export async function obtenerDetallePresupuesto(
  id: string
): Promise<DetallePresupuestoCompleto | null> {
  const supabase = await createClient();

  const { data: p, error } = await supabase
    .from("presupuestos")
    .select(
      `
      *,
      cliente:clientes(*),
      detalles:detalle_presupuesto(
        *,
        producto:productos(*)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !p) {
    console.error("Error al obtener detalle del presupuesto:", error);
    return null;
  }

  const now = new Date().getTime();
  const fechaVigenciaMs = new Date(p.fecha_vigencia).getTime();
  const esVencido = p.estado === "vigente" && fechaVigenciaMs < now;

  const detalles = (p.detalles ?? []).map((det: any) => {
    const prod = det.producto;
    const precioCotizado = Number(det.precio_unitario_usd_referencia);
    const precioActual = prod ? Number(prod.precio_venta_usd) : precioCotizado;
    const stockActual = prod ? Number(prod.stock_actual) : 0;
    const cantidadRequerida = Number(det.cantidad);

    return {
      ...det,
      cantidad: cantidadRequerida,
      precio_unitario_usd_referencia: precioCotizado,
      subtotal_usd: Number(det.subtotal_usd),
      producto: prod,
      precio_actual_cambio: Math.abs(precioActual - precioCotizado) > 0.001,
      stock_insuficiente: stockActual < cantidadRequerida,
    };
  });

  return {
    ...p,
    subtotal_usd: Number(p.subtotal_usd),
    descuento_usd: Number(p.descuento_usd),
    total_usd: Number(p.total_usd),
    tasa_cambio_referencia: p.tasa_cambio_referencia ? Number(p.tasa_cambio_referencia) : null,
    total_bs_referencia: p.total_bs_referencia ? Number(p.total_bs_referencia) : null,
    es_vencido: esVencido,
    detalles,
  };
}

/**
 * Cancelar un presupuesto llamando a la RPC atómica `cancelar_presupuesto_rpc` (SECURITY DEFINER).
 */
export async function cancelarPresupuesto(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  const { data, error } = await supabase.rpc("cancelar_presupuesto_rpc", {
    p_presupuesto_id: id,
  });

  if (error) {
    console.error("Error en RPC cancelar_presupuesto_rpc:", error.message);
    return { error: `Error al cancelar presupuesto: ${error.message}` };
  }

  revalidatePath("/dashboard/presupuestos");
  revalidatePath(`/dashboard/presupuestos/${id}`);
  return { success: true, data };
}

/**
 * Buscar productos activos para el módulo de presupuestos.
 */
export async function buscarProductosPresupuesto(query: string = ""): Promise<Producto[]> {
  const supabase = await createClient();

  let productosQuery = supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .limit(40);

  const cleanQuery = query.trim();

  if (cleanQuery) {
    productosQuery = productosQuery.or(
      `nombre.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%,codigo_barras.ilike.%${cleanQuery}%`
    );
  }

  const { data, error } = await productosQuery;

  if (error) {
    console.error("Error al buscar productos para presupuesto:", error);
    return [];
  }

  return (data ?? []) as Producto[];
}
