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
  presupuesto_id?: string | null;
}

import { confirmarVentaSchema, getZodErrorMessage } from "@/lib/schemas/actions-schemas";

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
 * Validar credenciales de un Administrador para autorizar venta con stock insuficiente/descuento.
 * Incluye Rate Limiting atómico con pg_advisory_xact_lock en la RPC verificar_y_registrar_intento_admin.
 */
export async function autorizarVentaAdmin(password: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Usuario actual no válido." };
  }

  // Validar si el usuario actual es admin
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (perfil?.role !== "admin") {
    return { error: "El usuario actual no tiene rol de Administrador para autorizar esta acción." };
  }

  // 1. Intentar autenticar la contraseña del administrador contra Supabase Auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: password,
  });

  const exitoAutenticacion = !authError;

  // 2. Invocar la RPC atómica con pg_advisory_xact_lock para verificar el límite y registrar auditoría
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("verificar_y_registrar_intento_admin", {
    p_usuario_id: user.id,
    p_email: user.email,
    p_exito: exitoAutenticacion,
  });

  if (rpcErr) {
    console.error("Error al registrar auditoría de intento admin:", rpcErr.message);
  }

  // 3. Si la RPC detectó que ya estaba bloqueado o alcanzó el límite
  if (rpcRes?.bloqueado) {
    return {
      error: rpcRes.mensaje || "Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por 5 minutos.",
      bloqueado: true,
    };
  }

  if (!exitoAutenticacion) {
    const restantes = rpcRes?.intentos_restantes ?? 0;
    return {
      error: `Contraseña de Administrador incorrecta. Intentos restantes: ${restantes}.`,
    };
  }

  return { autorizada: true, adminUserId: user.id };
}
