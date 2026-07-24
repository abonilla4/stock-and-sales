"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
}

/**
 * Confirmar una venta llamando a la RPC atómica `procesar_venta_transaccion`.
 *
 * La RPC maneja atómicamente: inserción de venta, detalle, descuento de stock,
 * movimientos de inventario, y actualización de saldo_fiado (si es fiado).
 *
 * NO hay fallback: si la RPC falla, se retorna el error directamente.
 */
export async function confirmarVentaPOS(params: ConfirmarVentaParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  if (!params.items || params.items.length === 0) {
    return { error: "El carrito de venta no contiene ningún producto." };
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

  // Llamar a la función RPC atómica (única vía de modificación de stock/saldo)
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
  });

  if (rpcError) {
    // Distinguir errores de stock para UX diferenciada en el frontend
    if (rpcError.message.includes("Stock insuficiente")) {
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
 * Validar credenciales de un Administrador para autorizar venta con stock insuficiente.
 */
export async function autorizarVentaAdmin(password: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Usuario actual no válido." };
  }

  // Validar si el usuario actual es admin intentando re-autenticar o verificar rol
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (perfil?.role !== "admin") {
    return { error: "El usuario actual no tiene rol de Administrador para autorizar esta acción." };
  }

  // Verificar la contraseña del administrador contra Supabase Auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: password,
  });

  if (authError) {
    return { error: "Contraseña de Administrador incorrecta." };
  }

  return { autorizada: true, adminUserId: user.id };
}
