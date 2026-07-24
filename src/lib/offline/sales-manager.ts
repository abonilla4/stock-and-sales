import { db, type VentaOffline, type RegistroAuditoria } from "./db";
import { confirmarVentaPOS, type ConfirmarVentaParams } from "@/app/dashboard/pos/actions";
import type { ReciboVentaData } from "@/components/pos/pos-receipt-dialog";

export interface ProcesarVentaResult {
  success: boolean;
  recibo?: ReciboVentaData;
  error?: string;
  esOffline?: boolean;
  esErrorStock?: boolean;
}

/**
 * Procesa una venta en el POS.
 * Si hay conexión (y no está forzado el modo simulación offline), intenta registrar directamente en Supabase.
 * Si falla la red o está offline/simulación, guarda la venta en IndexedDB `cola_ventas`.
 */
export async function procesarVentaPOS(
  params: ConfirmarVentaParams,
  nombresProductosMap: Record<string, string>,
  clienteNombre?: string,
  forzarOffline: boolean = false
): Promise<ProcesarVentaResult> {
  const estaOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // 1. Si está online y no está forzada la simulación offline, intentar con Supabase
  if (estaOnline && !forzarOffline) {
    try {
      const res = await confirmarVentaPOS(params);
      if (res.success && res.recibo) {
        const reciboObj: ReciboVentaData = {
          venta_id: res.recibo.venta_id,
          fecha: res.recibo.fecha,
          total_usd: res.recibo.total_usd,
          total_bs: res.recibo.total_bs,
          tasa_cambio_aplicada: res.recibo.tasa_cambio_aplicada,
          subtotal_usd: params.subtotal_usd,
          descuento_usd: params.descuento_usd,
          metodo_pago: params.metodo_pago,
          cliente_nombre: clienteNombre,
          items: params.items.map((i) => ({
            nombre: nombresProductosMap[i.producto_id] || "Producto",
            cantidad: i.cantidad,
            unidad_medida: "unidad",
            precio_unitario_usd: i.precio_unitario_usd,
            subtotal_usd: i.subtotal_usd,
          })),
        };
        return { success: true, recibo: reciboObj, esOffline: false };
      }

      if (res.error) {
        // Si fue un error de negocio (ej: stock insuficiente), devolverlo directamente
        if (res.esErrorStock || !res.error.includes("fetch")) {
          return { success: false, error: res.error, esErrorStock: res.esErrorStock };
        }
      }
    } catch (err: unknown) {
      console.warn("Fallo de red al conectar con Supabase. Guardando venta en cola offline...", err);
    }
  }

  // 2. Modo Offline (sin red o simulación activada): Encolar en IndexedDB
  try {
    const clientTxId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `off_${Date.now()}`;
    const fechaActual = new Date().toISOString();

    const ventaOffline: VentaOffline = {
      client_tx_id: clientTxId,
      cliente_id: params.cliente_id,
      fecha: fechaActual,
      subtotal_usd: params.subtotal_usd,
      descuento_usd: params.descuento_usd,
      total_usd: params.total_usd,
      total_bs: params.total_bs,
      tasa_cambio_aplicada: params.tasa_cambio_aplicada,
      metodo_pago: params.metodo_pago,
      items: params.items.map((i) => ({
        producto_id: i.producto_id,
        nombre_producto: nombresProductosMap[i.producto_id] || "Producto",
        cantidad: i.cantidad,
        precio_unitario_usd: i.precio_unitario_usd,
        subtotal_usd: i.subtotal_usd,
      })),
      estado_sync: "pendiente",
      created_at: fechaActual,
    };

    const idLocal = await db.cola_ventas.add(ventaOffline);

    // Registrar en auditoría local
    await db.registro_auditoria.add({
      fecha: fechaActual,
      accion: "VENTA_OFFLINE_CREADA",
      detalle: `Venta de $${params.total_usd.toFixed(2)} USD guardada en cola local (#${idLocal}).`,
      client_tx_id: clientTxId,
      sincronizado: false,
    });

    const reciboOfflineObj: ReciboVentaData = {
      venta_id: `OFF-${idLocal}`,
      fecha: fechaActual,
      total_usd: params.total_usd,
      total_bs: params.total_bs,
      tasa_cambio_aplicada: params.tasa_cambio_aplicada,
      subtotal_usd: params.subtotal_usd,
      descuento_usd: params.descuento_usd,
      metodo_pago: params.metodo_pago,
      cliente_nombre: clienteNombre,
      esOffline: true,
      items: params.items.map((i) => ({
        nombre: nombresProductosMap[i.producto_id] || "Producto",
        cantidad: i.cantidad,
        unidad_medida: "unidad",
        precio_unitario_usd: i.precio_unitario_usd,
        subtotal_usd: i.subtotal_usd,
      })),
    };

    return {
      success: true,
      recibo: reciboOfflineObj,
      esOffline: true,
    };
  } catch (err: unknown) {
    console.error("Error al guardar venta en cola offline:", err);
    return {
      success: false,
      error: "No se pudo guardar la venta localmente.",
    };
  }
}

/**
 * Obtiene el conteo de ventas pendientes de sincronizar en la cola local.
 */
export async function obtenerConteoPendientesSync(): Promise<number> {
  try {
    return await db.cola_ventas.where("estado_sync").equals("pendiente").count();
  } catch {
    return 0;
  }
}

/**
 * Sincroniza las ventas pendientes almacenadas en IndexedDB `cola_ventas` hacia Supabase.
 */
export async function sincronizarColaVentas(): Promise<{
  procesadas: number;
  exitosas: number;
  errores: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { procesadas: 0, exitosas: 0, errores: 0 };
  }

  const pendientes = await db.cola_ventas
    .where("estado_sync")
    .equals("pendiente")
    .toArray();

  if (pendientes.length === 0) {
    return { procesadas: 0, exitosas: 0, errores: 0 };
  }

  let exitosas = 0;
  let errores = 0;

  for (const venta of pendientes) {
    if (!venta.id) continue;

    // Marcar como en proceso
    await db.cola_ventas.update(venta.id, { estado_sync: "sincronizando" });

    try {
      // 1. Intentar sincronización normal sin forzar stock negativo
      const paramsPayload: ConfirmarVentaParams = {
        cliente_id: venta.cliente_id,
        subtotal_usd: venta.subtotal_usd,
        descuento_usd: venta.descuento_usd,
        total_usd: venta.total_usd,
        tasa_cambio_aplicada: venta.tasa_cambio_aplicada,
        total_bs: venta.total_bs,
        metodo_pago: venta.metodo_pago,
        items: venta.items.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario_usd: i.precio_unitario_usd,
          subtotal_usd: i.subtotal_usd,
        })),
        permitir_stock_negativo: false, // Verificar stock real primero
        client_tx_id: venta.client_tx_id, // Idempotencia: evita duplicar si la sync se reintenta
      };

      let res = await confirmarVentaPOS(paramsPayload);

      // 2. Si falló por stock insuficiente, reintentar con origen_autorizacion = 'offline_diferido'
      if (!res.success && res.esErrorStock) {
        console.warn(`Stock insuficiente al sincronizar venta client_tx_id:${venta.client_tx_id}. Aplicando stock negativo diferido...`);
        const payloadDiferido: ConfirmarVentaParams = {
          ...paramsPayload,
          permitir_stock_negativo: true,
          origen_autorizacion: "offline_diferido",
        };
        res = await confirmarVentaPOS(payloadDiferido);

        if (res.success) {
          await db.cola_ventas.update(venta.id, { estado_sync: "sincronizado" });
          await db.registro_auditoria.add({
            fecha: new Date().toISOString(),
            accion: "SYNC_VENTA_STOCK_NEGATIVO_REVISION",
            detalle: `Venta offline client_tx_id:${venta.client_tx_id} sincronizada con stock insuficiente diferido. Requiere revisión manual.`,
            client_tx_id: venta.client_tx_id,
            sincronizado: true,
          });
          exitosas++;
          continue;
        }
      }

      if (res.success) {
        await db.cola_ventas.update(venta.id, { estado_sync: "sincronizado" });
        await db.registro_auditoria.add({
          fecha: new Date().toISOString(),
          accion: "SYNC_VENTA_EXITOSA",
          detalle: `Venta offline client_tx_id:${venta.client_tx_id} sincronizada correctamente en Supabase.`,
          client_tx_id: venta.client_tx_id,
          sincronizado: true,
        });
        exitosas++;
      } else {
        await db.cola_ventas.update(venta.id, {
          estado_sync: "error",
          error_mensaje: res.error || "Error al sincronizar con el servidor",
        });
        await db.registro_auditoria.add({
          fecha: new Date().toISOString(),
          accion: "SYNC_VENTA_ERROR",
          detalle: `Fallo al sincronizar venta client_tx_id:${venta.client_tx_id}: ${res.error}`,
          client_tx_id: venta.client_tx_id,
          sincronizado: false,
        });
        errores++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.cola_ventas.update(venta.id, {
        estado_sync: "pendiente", // Reintentar después
        error_mensaje: msg,
      });
      errores++;
    }
  }

  return {
    procesadas: pendientes.length,
    exitosas,
    errores,
  };
}
