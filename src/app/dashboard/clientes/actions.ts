"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Venta, PagoFiado, MetodoPago } from "@/lib/types/database";

/**
 * Obtener lista de clientes con búsqueda opcional por nombre o identificación.
 */
export async function obtenerClientes(query: string = ""): Promise<Cliente[]> {
  const supabase = await createClient();

  let clientesQuery = supabase
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });

  const cleanQuery = query.trim();

  if (cleanQuery) {
    clientesQuery = clientesQuery.or(
      `nombre.ilike.%${cleanQuery}%,identificacion.ilike.%${cleanQuery}%,telefono.ilike.%${cleanQuery}%`
    );
  }

  const { data, error } = await clientesQuery;

  if (error) {
    console.error("Error al obtener clientes:", error);
    return [];
  }

  return (data ?? []) as Cliente[];
}

/**
 * Crear un nuevo cliente.
 */
export async function crearCliente(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  const nombre = (formData.get("nombre") as string)?.trim();
  const identificacion = (formData.get("identificacion") as string)?.trim() || null;
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre del cliente es obligatorio." };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre,
      identificacion,
      telefono,
      notas,
      saldo_fiado: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error al crear cliente:", error);
    return { error: `Error al crear cliente: ${error.message}` };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath("/dashboard/pos");

  return { success: true, clienteId: data.id };
}

/**
 * Actualizar datos de un cliente existente.
 */
export async function actualizarCliente(id: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  const nombre = (formData.get("nombre") as string)?.trim();
  const identificacion = (formData.get("identificacion") as string)?.trim() || null;
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre del cliente es obligatorio." };
  }

  const { error } = await supabase
    .from("clientes")
    .update({
      nombre,
      identificacion,
      telefono,
      notas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar cliente:", error);
    return { error: `Error al actualizar cliente: ${error.message}` };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${id}`);
  revalidatePath("/dashboard/pos");

  return { success: true };
}

export interface DetalleClienteData {
  cliente: Cliente;
  ventas: Venta[];
  abonos: PagoFiado[];
}

/**
 * Obtener la ficha completa del cliente, sus ventas asociadas y su historial de abonos.
 */
export async function obtenerDetalleCliente(id: string): Promise<DetalleClienteData | null> {
  const supabase = await createClient();

  const [{ data: cliente, error: clienteError }, { data: ventas }, { data: abonos }] =
    await Promise.all([
      supabase.from("clientes").select("*").eq("id", id).single(),
      supabase
        .from("ventas")
        .select("*")
        .eq("cliente_id", id)
        .order("fecha", { ascending: false }),
      supabase
        .from("pagos_fiado")
        .select("*")
        .eq("cliente_id", id)
        .order("fecha", { ascending: false }),
    ]);

  if (clienteError || !cliente) {
    console.error("Error al obtener detalle de cliente:", clienteError);
    return null;
  }

  return {
    cliente: cliente as Cliente,
    ventas: (ventas ?? []) as Venta[],
    abonos: (abonos ?? []) as PagoFiado[],
  };
}

export interface RegistrarAbonoParams {
  cliente_id: string;
  monto_usd: number;
  monto_bs: number | null;
  metodo_pago: MetodoPago;
  venta_id?: string | null;
  notas?: string | null;
}

/**
 * Registrar un abono a la cuenta del cliente vía RPC atómica `registrar_abono_fiado`.
 *
 * La RPC maneja atómicamente: inserción en pagos_fiado + descuento de saldo_fiado.
 *
 * NO hay fallback: si la RPC falla, se retorna el error directamente.
 */
export async function registrarAbonoCliente(params: RegistrarAbonoParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión expirada. Por favor inicie sesión de nuevo." };
  }

  if (params.monto_usd <= 0) {
    return { error: "El monto del abono debe ser mayor a $0.00 USD." };
  }

  // Llamar a la RPC atómica (única vía de modificación de saldo_fiado)
  const { data: rpcData, error: rpcError } = await supabase.rpc("registrar_abono_fiado", {
    p_cliente_id: params.cliente_id,
    p_monto_usd: params.monto_usd,
    p_monto_bs: params.monto_bs,
    p_metodo_pago: params.metodo_pago,
    p_venta_id: params.venta_id ?? null,
    p_notas: params.notas ?? null,
  });

  if (rpcError) {
    console.error("Error en RPC registrar_abono_fiado:", rpcError.message);
    return { error: `Error al registrar abono: ${rpcError.message}` };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${params.cliente_id}`);
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard");

  return {
    success: true,
    data: rpcData,
  };
}

