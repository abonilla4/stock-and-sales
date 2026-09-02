"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { autorizarAccion } from "@/lib/auth/autorizacion";
import {
  autorizarVentaAdminSchema,
  confirmarVentaSchema,
  getZodErrorMessage,
} from "@/lib/schemas/actions-schemas";
import type { PermisoAutorizacion } from "@/lib/schemas/actions-schemas";
import type { Producto, Cliente, MetodoPago } from "@/lib/types/database";

/**
 * Buscar productos activos para el POS por Nombre, SKU o Código de Barras.
 */
export async function buscarProductosPOS(query: string = ""): Promise<Producto[]> {
  const supabase = await createClient();

  let productosQuery = supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .limit(30);

  const cleanQuery = query.trim();

  if (cleanQuery) {
    productosQuery = productosQuery.or(
      `nombre.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%,codigo_barras.ilike.%${cleanQuery}%`
    );
  }

  const { data, error } = await productosQuery;

  if (error) {
    console.error("Error al buscar productos para POS:", error);
    return [];
  }

  return (data ?? []) as Producto[];
}

/**
 * Obtener lista de clientes registrados para la selección en el checkout del POS.
 */
export async function obtenerClientesPOS(): Promise<Cliente[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al obtener clientes para POS:", error);
    return [];
  }

  return (data ?? []) as Cliente[];
}

export interface ConfirmarVentaParams {
  cliente_id: string | null;
  subtotal_usd: number;
  descuento_usd: number;
  total_usd: number;
  tasa_cambio_aplicada: number;
  total_bs: number;
  metodo_pago: MetodoPago;
  items: {
    producto_id: string;
    cantidad: number;
    precio_unitario_usd: number;
    subtotal_usd: number;
  }[];
  permitir_stock_negativo?: boolean;
  client_tx_id?: string | null;
  autorizado_por?: string | null;
  origen_autorizacion?: "admin_online" | "offline_diferido" | null;
  presupuesto_id?: string | null;
}

/**
 * Confirmar una venta llamando a la RPC atómica `procesar_venta_transaccion`.
 *
 * La RPC maneja atómicamente: inserción de venta, detalle, descuento de stock,
 * movimientos de inventario, actualización de saldo_fiado (si es fiado)
 * y marcado de presupuesto a 'convertido' (si proviene de cotización).
 *
 * NO hay fallback: si la RPC falla, se retorna el error directamente.
 */
export async function confirmarVentaPOS(params: ConfirmarVentaParams) {
  // Validación de esquema Zod antes de consultar la BD
  const parseResult = confirmarVentaSchema.safeParse(params);
  if (!parseResult.success) {
    return { error: getZodErrorMessage(parseResult.error) };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  // Resolver autorización y su origen auditado
  let autorizadoPor: string | null = null;
  let origenAutorizacion: "admin_online" | "offline_diferido" | null = null;

  if (params.permitir_stock_negativo) {
    if (params.origen_autorizacion === "offline_diferido") {
      autorizadoPor = null; // Nadie autorizó en vivo — requiere revisión manual
      origenAutorizacion = "offline_diferido";
    } else {
      autorizadoPor = params.autorizado_por ?? null;
      origenAutorizacion = "admin_online";
    }
  }

  // Llamar a la función RPC atómica (única vía de modificación de stock/saldo/conversión)
  const { data: rpcData, error: rpcError } = await supabase.rpc("procesar_venta_transaccion", {
    p_cliente_id: params.cliente_id,
    p_subtotal_usd: params.subtotal_usd,
    p_descuento_usd: params.descuento_usd,
    p_total_usd: params.total_usd,
    p_tasa_cambio_aplicada: params.tasa_cambio_aplicada,
    p_total_bs: params.total_bs,
    p_metodo_pago: params.metodo_pago,
    p_items: params.items,
    p_permitir_stock_negativo: params.permitir_stock_negativo ?? false,
    p_client_tx_id: params.client_tx_id ?? null,
    p_autorizado_por: autorizadoPor,
    p_origen_autorizacion: origenAutorizacion,
    p_presupuesto_id: params.presupuesto_id ?? null,
  });

  if (rpcError) {
    // Distinguir errores de stock para UX diferenciada en el frontend
    if (
      rpcError.message.includes("Stock insuficiente") ||
      rpcError.message.includes("autorización") ||
      rpcError.message.includes("descuento")
    ) {
      return {
        error: rpcError.message,
        esErrorStock: true,
      };
    }

    console.error("Error en RPC procesar_venta_transaccion:", rpcError.message);
    return { error: `Error al procesar la venta: ${rpcError.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/clientes");

  return {
    success: true,
    recibo: rpcData,
  };
}

/**
 * Autorización delegada de una venta de excepción.
 *
 * Un administrador presta sus credenciales para autorizar una venta que el
 * cajero no puede hacer solo. Recibe email además de contraseña porque el
 * autorizador NO es el usuario en sesión.
 *
 * La versión anterior de esta acción tenía dos defectos que este refactor
 * corrige:
 *
 *   1. Exigía que el usuario en sesión ya fuera admin, con lo que un cajero
 *      nunca podía pedir autorización — el flujo entero era inalcanzable para
 *      el único rol que lo necesitaba.
 *   2. Autenticaba con el cliente de servidor, que escribe cookies: validar al
 *      admin REEMPLAZABA la sesión del cajero.
 *
 * Ambos viven ahora en `autorizarAccion`, que valida contra un cliente efímero
 * sin cookies. Aquí solo se valida la forma del payload y se traduce el
 * resultado.
 */
export async function autorizarVentaAdmin(
  email: string,
  password: string,
  permisosRequeridos: PermisoAutorizacion[]
) {
  const parsed = autorizarVentaAdminSchema.safeParse({
    email,
    password,
    permisos_requeridos: permisosRequeridos,
  });

  if (!parsed.success) {
    return { error: getZodErrorMessage(parsed.error) };
  }

  const resultado = await autorizarAccion({
    permisosRequeridos: parsed.data.permisos_requeridos,
    credenciales: {
      email: parsed.data.email,
      password: parsed.data.password,
    },
  });

  if (!resultado.ok) {
    return { error: resultado.error, bloqueado: resultado.bloqueado };
  }

  return { autorizada: true, adminUserId: resultado.autorizadoPor };
}
