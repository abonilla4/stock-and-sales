"use server";

import { createClient } from "@/lib/supabase/server";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";
import type { MetodoPago } from "@/lib/types/database";

export interface ReporteVentasPeriodo {
  totalVentasCount: number;
  totalIngresosUsd: number;
  totalIngresosBs: number;
  ticketPromedioUsd: number;
  ticketPromedioBs: number;
  ventasPorFecha: {
    fecha: string;
    ventasCount: number;
    totalUsd: number;
    totalBs: number;
  }[];
}

export interface TopProductoItem {
  productoId: string;
  sku: string;
  nombre: string;
  unidadMedida: string;
  cantidadVendida: number;
  totalIngresosUsd: number;
  totalIngresosBs: number;
}

export interface ReporteMargenGanancia {
  ingresosTotalesUsd: number;
  ingresosTotalesBs: number;
  costoVentasUsd: number;
  costoVentasBs: number;
  gananciaBrutaUsd: number;
  gananciaBrutaBs: number;
  porcentajeMargen: number;
}

export interface InventarioValorizadoCategoria {
  categoriaId: string;
  categoriaNombre: string;
  totalProductos: number;
  stockTotal: number;
  valorCostoUsd: number;
  valorVentaUsd: number;
  gananciaEstimadaUsd: number;
}

export interface ReporteInventarioValorizado {
  totalProductosActivos: number;
  stockTotalGlobal: number;
  valorTotalCostoUsd: number;
  valorTotalCostoBs: number;
  valorTotalVentaUsd: number;
  valorTotalVentaBs: number;
  gananciaEstimadaGlobalUsd: number;
  gananciaEstimadaGlobalBs: number;
  porCategoria: InventarioValorizadoCategoria[];
}

export interface ClienteDeudaItem {
  clienteId: string;
  nombre: string;
  identificacion: string | null;
  telefono: string | null;
  saldoUsd: number;
  saldoBs: number;
  ultimoAbonoFecha: string | null;
}

export interface ReporteCuentasPorCobrar {
  totalClientesConDeuda: number;
  saldoTotalPorCobrarUsd: number;
  saldoTotalPorCobrarBs: number;
  abonosRecibidosEnPeriodoUsd: number;
  abonosRecibidosEnPeriodoBs: number;
  clientesDeudores: ClienteDeudaItem[];
}

/**
 * 1. Reporte de Ventas por Período
 */
export async function obtenerReporteVentasPeriodo(
  fechaInicio: string,
  fechaFin: string
): Promise<ReporteVentasPeriodo> {
  const supabase = await createClient();
  const tasaActivaData = await obtenerTasaActiva();
  const tasaActiva = tasaActivaData?.tasa ?? 1;

  // Ajustar fechaFin al final del día
  const fechaFinAjustada = new Date(fechaFin);
  fechaFinAjustada.setHours(23, 59, 59, 999);

  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("id, fecha, total_usd, total_bs, tasa_cambio_aplicada, estado")
    .eq("estado", "completada")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFinAjustada.toISOString())
    .order("fecha", { ascending: true });

  if (error || !ventas) {
    console.error("Error al obtener ventas por período:", error);
    return {
      totalVentasCount: 0,
      totalIngresosUsd: 0,
      totalIngresosBs: 0,
      ticketPromedioUsd: 0,
      ticketPromedioBs: 0,
      ventasPorFecha: [],
    };
  }

  const totalVentasCount = ventas.length;
  const totalIngresosUsd = Number(
    ventas.reduce((acc, v) => acc + (v.total_usd || 0), 0).toFixed(2)
  );
  const totalIngresosBs = Number(
    ventas.reduce((acc, v) => acc + (v.total_bs || 0), 0).toFixed(2)
  );

  const ticketPromedioUsd =
    totalVentasCount > 0 ? Number((totalIngresosUsd / totalVentasCount).toFixed(2)) : 0;
  const ticketPromedioBs =
    totalVentasCount > 0 ? Number((totalIngresosBs / totalVentasCount).toFixed(2)) : 0;

  // Agrupar ventas por día
  const mapaFechas: Record<string, { count: number; usd: number; bs: number }> = {};

  ventas.forEach((v) => {
    const diaKey = new Date(v.fecha).toISOString().split("T")[0];
    if (!mapaFechas[diaKey]) {
      mapaFechas[diaKey] = { count: 0, usd: 0, bs: 0 };
    }
    mapaFechas[diaKey].count += 1;
    mapaFechas[diaKey].usd += v.total_usd || 0;
    mapaFechas[diaKey].bs += v.total_bs || 0;
  });

  const ventasPorFecha = Object.keys(mapaFechas).map((dia) => ({
    fecha: dia,
    ventasCount: mapaFechas[dia].count,
    totalUsd: Number(mapaFechas[dia].usd.toFixed(2)),
    totalBs: Number(mapaFechas[dia].bs.toFixed(2)),
  }));

  return {
    totalVentasCount,
    totalIngresosUsd,
    totalIngresosBs,
    ticketPromedioUsd,
    ticketPromedioBs,
    ventasPorFecha,
  };
}

/**
 * 2. Reporte de Productos Más Vendidos (Top Ventas)
 */
export async function obtenerReporteTopProductos(
  fechaInicio: string,
  fechaFin: string,
  limite: number = 10
): Promise<TopProductoItem[]> {
  const supabase = await createClient();
  const tasaActivaData = await obtenerTasaActiva();
  const tasaActiva = tasaActivaData?.tasa ?? 1;

  const fechaFinAjustada = new Date(fechaFin);
  fechaFinAjustada.setHours(23, 59, 59, 999);

  // Obtener ventas completadas en el rango
  const { data: ventas } = await supabase
    .from("ventas")
    .select("id")
    .eq("estado", "completada")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFinAjustada.toISOString());

  if (!ventas || ventas.length === 0) {
    return [];
  }

  const ventaIds = ventas.map((v) => v.id);

  // Obtener líneas de detalle con datos de producto
  const { data: detalles, error } = await supabase
    .from("detalle_venta")
    .select(
      "producto_id, cantidad, subtotal_usd, productos(id, sku, nombre, unidad_medida)"
    )
    .in("venta_id", ventaIds);

  if (error || !detalles) {
    console.error("Error al obtener detalle de top productos:", error);
    return [];
  }

  // Agrupar por producto
  const mapaProductos: Record<
    string,
    { sku: string; nombre: string; unidad: string; cantidad: number; usd: number }
  > = {};

  detalles.forEach((item) => {
    const pid = item.producto_id;
    const prod = item.productos as unknown as { sku?: string; nombre?: string; unidad_medida?: string } | null;

    if (!mapaProductos[pid]) {
      mapaProductos[pid] = {
        sku: prod?.sku || "—",
        nombre: prod?.nombre || "Producto sin nombre",
        unidad: prod?.unidad_medida || "unidad",
        cantidad: 0,
        usd: 0,
      };
    }

    mapaProductos[pid].cantidad += Number(item.cantidad || 0);
    mapaProductos[pid].usd += Number(item.subtotal_usd || 0);
  });

  const resultado = Object.keys(mapaProductos).map((pid) => {
    const item = mapaProductos[pid];
    const totalUsd = Number(item.usd.toFixed(2));
    const totalBs = Number((totalUsd * tasaActiva).toFixed(2));
    return {
      productoId: pid,
      sku: item.sku,
      nombre: item.nombre,
      unidadMedida: item.unidad,
      cantidadVendida: Number(item.cantidad.toFixed(2)),
      totalIngresosUsd: totalUsd,
      totalIngresosBs: totalBs,
    };
  });

  // Ordenar por cantidad vendida descendente
  resultado.sort((a, b) => b.cantidadVendida - a.cantidadVendida);

  return resultado.slice(0, limite);
}

/**
 * 3. Reporte de Margen y Ganancia (Utilidad Bruta)
 */
export async function obtenerReporteMargenGanancia(
  fechaInicio: string,
  fechaFin: string
): Promise<ReporteMargenGanancia> {
  const supabase = await createClient();
  const tasaActivaData = await obtenerTasaActiva();
  const tasaActiva = tasaActivaData?.tasa ?? 1;

  const fechaFinAjustada = new Date(fechaFin);
  fechaFinAjustada.setHours(23, 59, 59, 999);

  const { data: ventas } = await supabase
    .from("ventas")
    .select("id")
    .eq("estado", "completada")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFinAjustada.toISOString());

  if (!ventas || ventas.length === 0) {
    return {
      ingresosTotalesUsd: 0,
      ingresosTotalesBs: 0,
      costoVentasUsd: 0,
      costoVentasBs: 0,
      gananciaBrutaUsd: 0,
      gananciaBrutaBs: 0,
      porcentajeMargen: 0,
    };
  }

  const ventaIds = ventas.map((v) => v.id);

  const { data: detalles } = await supabase
    .from("detalle_venta")
    .select("cantidad, subtotal_usd, productos(precio_costo_usd)")
    .in("venta_id", ventaIds);

  let ingresosTotalesUsd = 0;
  let costoVentasUsd = 0;

  if (detalles) {
    detalles.forEach((d) => {
      const subtotal = Number(d.subtotal_usd || 0);
      const cantidad = Number(d.cantidad || 0);
      const prod = d.productos as unknown as { precio_costo_usd?: number } | null;
      const precioCosto = Number(prod?.precio_costo_usd || 0);

      ingresosTotalesUsd += subtotal;
      costoVentasUsd += cantidad * precioCosto;
    });
  }

  ingresosTotalesUsd = Number(ingresosTotalesUsd.toFixed(2));
  costoVentasUsd = Number(costoVentasUsd.toFixed(2));

  const gananciaBrutaUsd = Number(Math.max(0, ingresosTotalesUsd - costoVentasUsd).toFixed(2));

  const ingresosTotalesBs = Number((ingresosTotalesUsd * tasaActiva).toFixed(2));
  const costoVentasBs = Number((costoVentasUsd * tasaActiva).toFixed(2));
  const gananciaBrutaBs = Number((gananciaBrutaUsd * tasaActiva).toFixed(2));

  const porcentajeMargen =
    ingresosTotalesUsd > 0
      ? Number(((gananciaBrutaUsd / ingresosTotalesUsd) * 100).toFixed(2))
      : 0;

  return {
    ingresosTotalesUsd,
    ingresosTotalesBs,
    costoVentasUsd,
    costoVentasBs,
    gananciaBrutaUsd,
    gananciaBrutaBs,
    porcentajeMargen,
  };
}

/**
 * 4. Reporte de Inventario Valorizado
 */
export async function obtenerReporteInventarioValorizado(): Promise<ReporteInventarioValorizado> {
  const supabase = await createClient();
  const tasaActivaData = await obtenerTasaActiva();
  const tasaActiva = tasaActivaData?.tasa ?? 1;

  const [{ data: productos }, { data: categorias }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, categoria_id, precio_costo_usd, precio_venta_usd, stock_actual, activo, categorias(id, nombre)")
      .eq("activo", true),
    supabase.from("categorias").select("id, nombre"),
  ]);

  if (!productos) {
    return {
      totalProductosActivos: 0,
      stockTotalGlobal: 0,
      valorTotalCostoUsd: 0,
      valorTotalCostoBs: 0,
      valorTotalVentaUsd: 0,
      valorTotalVentaBs: 0,
      gananciaEstimadaGlobalUsd: 0,
      gananciaEstimadaGlobalBs: 0,
      porCategoria: [],
    };
  }

  const totalProductosActivos = productos.length;
  let stockTotalGlobal = 0;
  let valorTotalCostoUsd = 0;
  let valorTotalVentaUsd = 0;

  // Agrupamiento por categoría
  const mapaCategorias: Record<
    string,
    { nombre: string; totalProds: number; stock: number; costoUsd: number; ventaUsd: number }
  > = {};

  if (categorias) {
    categorias.forEach((c) => {
      mapaCategorias[c.id] = {
        nombre: c.nombre,
        totalProds: 0,
        stock: 0,
        costoUsd: 0,
        ventaUsd: 0,
      };
    });
  }

  // Categoría "Sin categoría" para productos huérfanos
  mapaCategorias["sin_categoria"] = {
    nombre: "Sin categoría",
    totalProds: 0,
    stock: 0,
    costoUsd: 0,
    ventaUsd: 0,
  };

  productos.forEach((p) => {
    const stock = Math.max(0, Number(p.stock_actual || 0));
    const costoUnit = Number(p.precio_costo_usd || 0);
    const ventaUnit = Number(p.precio_venta_usd || 0);

    const subtotalCosto = stock * costoUnit;
    const subtotalVenta = stock * ventaUnit;

    stockTotalGlobal += stock;
    valorTotalCostoUsd += subtotalCosto;
    valorTotalVentaUsd += subtotalVenta;

    const catKey = p.categoria_id && mapaCategorias[p.categoria_id] ? p.categoria_id : "sin_categoria";
    mapaCategorias[catKey].totalProds += 1;
    mapaCategorias[catKey].stock += stock;
    mapaCategorias[catKey].costoUsd += subtotalCosto;
    mapaCategorias[catKey].ventaUsd += subtotalVenta;
  });

  valorTotalCostoUsd = Number(valorTotalCostoUsd.toFixed(2));
  valorTotalVentaUsd = Number(valorTotalVentaUsd.toFixed(2));
  const gananciaEstimadaGlobalUsd = Number(
    Math.max(0, valorTotalVentaUsd - valorTotalCostoUsd).toFixed(2)
  );

  const valorTotalCostoBs = Number((valorTotalCostoUsd * tasaActiva).toFixed(2));
  const valorTotalVentaBs = Number((valorTotalVentaUsd * tasaActiva).toFixed(2));
  const gananciaEstimadaGlobalBs = Number((gananciaEstimadaGlobalUsd * tasaActiva).toFixed(2));

  const porCategoria: InventarioValorizadoCategoria[] = Object.keys(mapaCategorias)
    .filter((ckey) => mapaCategorias[ckey].totalProds > 0)
    .map((ckey) => {
      const cat = mapaCategorias[ckey];
      const costoUsd = Number(cat.costoUsd.toFixed(2));
      const ventaUsd = Number(cat.ventaUsd.toFixed(2));
      return {
        categoriaId: ckey,
        categoriaNombre: cat.nombre,
        totalProductos: cat.totalProds,
        stockTotal: Number(cat.stock.toFixed(2)),
        valorCostoUsd: costoUsd,
        valorVentaUsd: ventaUsd,
        gananciaEstimadaUsd: Number(Math.max(0, ventaUsd - costoUsd).toFixed(2)),
      };
    });

  return {
    totalProductosActivos,
    stockTotalGlobal: Number(stockTotalGlobal.toFixed(2)),
    valorTotalCostoUsd,
    valorTotalCostoBs,
    valorTotalVentaUsd,
    valorTotalVentaBs,
    gananciaEstimadaGlobalUsd,
    gananciaEstimadaGlobalBs,
    porCategoria,
  };
}

/**
 * 5. Reporte de Cuentas por Cobrar (Reporte de Crédito)
 */
export async function obtenerReporteCuentasPorCobrar(
  fechaInicio: string,
  fechaFin: string
): Promise<ReporteCuentasPorCobrar> {
  const supabase = await createClient();
  const tasaActivaData = await obtenerTasaActiva();
  const tasaActiva = tasaActivaData?.tasa ?? 1;

  const fechaFinAjustada = new Date(fechaFin);
  fechaFinAjustada.setHours(23, 59, 59, 999);

  const [{ data: clientes }, { data: abonos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nombre, identificacion, telefono, saldo_fiado")
      .gt("saldo_fiado", 0)
      .order("saldo_fiado", { ascending: false }),
    supabase
      .from("pagos_fiado")
      .select("monto_usd, monto_bs")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFinAjustada.toISOString()),
  ]);

  const clientesDeudores: ClienteDeudaItem[] = (clientes ?? []).map((c) => {
    const saldoUsd = Number((c.saldo_fiado || 0).toFixed(2));
    const saldoBs = Number((saldoUsd * tasaActiva).toFixed(2));
    return {
      clienteId: c.id,
      nombre: c.nombre,
      identificacion: c.identificacion,
      telefono: c.telefono,
      saldoUsd,
      saldoBs,
      ultimoAbonoFecha: null,
    };
  });

  const totalClientesConDeuda = clientesDeudores.length;
  const saldoTotalPorCobrarUsd = Number(
    clientesDeudores.reduce((acc, c) => acc + c.saldoUsd, 0).toFixed(2)
  );
  const saldoTotalPorCobrarBs = Number((saldoTotalPorCobrarUsd * tasaActiva).toFixed(2));

  const abonosRecibidosEnPeriodoUsd = Number(
    (abonos ?? []).reduce((acc, a) => acc + Number(a.monto_usd || 0), 0).toFixed(2)
  );
  const abonosRecibidosEnPeriodoBs = Number(
    (abonosRecibidosEnPeriodoUsd * tasaActiva).toFixed(2)
  );

  return {
    totalClientesConDeuda,
    saldoTotalPorCobrarUsd,
    saldoTotalPorCobrarBs,
    abonosRecibidosEnPeriodoUsd,
    abonosRecibidosEnPeriodoBs,
    clientesDeudores,
  };
}
