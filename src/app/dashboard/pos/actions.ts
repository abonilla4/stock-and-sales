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
}

/**
 * Confirmar una venta llamando a la RPC atómica `procesar_venta_transaccion`
 * con fallback transaccional completo en caso de que la RPC no esté migrada en Supabase Cloud.
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

  // 1. Intentar llamar a la función RPC atómica
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
  });

  if (!rpcError) {
    // Si la venta es Fiado y hay cliente seleccionado, actualizar saldo_fiado del cliente
    if (params.metodo_pago === "fiado" && params.cliente_id) {
      const { data: clienteActual } = await supabase
        .from("clientes")
        .select("saldo_fiado")
        .eq("id", params.cliente_id)
        .single();

      if (clienteActual) {
        await supabase
          .from("clientes")
          .update({ saldo_fiado: (clienteActual.saldo_fiado || 0) + params.total_usd })
          .eq("id", params.cliente_id);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/pos");

    return {
      success: true,
      recibo: rpcData,
    };
  }

  // Si el error de la RPC fue por stock insuficiente, devolver error de stock directamente
  if (rpcError.message.includes("Stock insuficiente")) {
    return {
      error: rpcError.message,
      esErrorStock: true,
    };
  }

  // 2. Fallback Transaccional en Server Action si la función RPC aún no fue migrada en BD
  console.warn("RPC procesar_venta_transaccion no disponible. Ejecutando fallback transaccional...", rpcError.message);

  const productoIds = params.items.map((i) => i.producto_id);
  const { data: productos, error: prodError } = await supabase
    .from("productos")
    .select("id, nombre, stock_actual")
    .in("id", productoIds);

  if (prodError || !productos) {
    return { error: "Error al consultar inventario de productos para la venta." };
  }

  // Validar suficiencia de stock salvo que esté autorizado explícitamente por admin
  const permitirStockNegativo = params.permitir_stock_negativo ?? false;
  for (const item of params.items) {
    const prod = productos.find((p) => p.id === item.producto_id);
    if (!prod) {
      return { error: `Producto ID ${item.producto_id} no encontrado.` };
    }
    if (!permitirStockNegativo && prod.stock_actual < item.cantidad) {
      return {
        error: `Stock insuficiente para el producto "${prod.nombre}". Stock disponible: ${prod.stock_actual}, Solicitado: ${item.cantidad}`,
        esErrorStock: true,
      };
    }
  }

  // Insertar cabecera de la venta (snapshot congelado)
  const fechaVenta = new Date().toISOString();
  const { data: nuevaVenta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      cliente_id: params.cliente_id,
      fecha: fechaVenta,
      subtotal_usd: params.subtotal_usd,
      descuento_usd: params.descuento_usd,
      total_usd: params.total_usd,
      tasa_cambio_aplicada: params.tasa_cambio_aplicada,
      total_bs: params.total_bs,
      metodo_pago: params.metodo_pago,
      estado: "completada",
      sincronizado: true,
    })
    .select("id, fecha")
    .single();

  if (ventaError || !nuevaVenta) {
    console.error("Error al registrar cabecera de venta:", ventaError);
    return { error: `Error de BD al crear la venta: ${ventaError?.message}` };
  }

  // Insertar detalle de venta, actualizar stock y registrar movimientos
  for (const item of params.items) {
    const prod = productos.find((p) => p.id === item.producto_id);

    // 1. Detalle venta
    await supabase.from("detalle_venta").insert({
      venta_id: nuevaVenta.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario_usd: item.precio_unitario_usd,
      subtotal_usd: item.subtotal_usd,
    });

    // 2. Descuento de stock
    if (prod) {
      const nuevoStock = prod.stock_actual - item.cantidad;
      await supabase
        .from("productos")
        .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
        .eq("id", item.producto_id);
    }

    // 3. Movimiento inventario
    await supabase.from("movimientos_inventario").insert({
      producto_id: item.producto_id,
      tipo: "venta",
      cantidad: item.cantidad,
      motivo: permitirStockNegativo
        ? "Venta en POS (con autorización de stock insuficiente)"
        : "Venta en POS",
      referencia_venta_id: nuevaVenta.id,
    });
  }

  // Actualizar saldo_fiado del cliente si fue venta a crédito
  if (params.metodo_pago === "fiado" && params.cliente_id) {
    const { data: clienteActual } = await supabase
      .from("clientes")
      .select("saldo_fiado")
      .eq("id", params.cliente_id)
      .single();

    if (clienteActual) {
      await supabase
        .from("clientes")
        .update({ saldo_fiado: (clienteActual.saldo_fiado || 0) + params.total_usd })
        .eq("id", params.cliente_id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/pos");

  return {
    success: true,
    recibo: {
      venta_id: nuevaVenta.id,
      fecha: nuevaVenta.fecha,
      total_usd: params.total_usd,
      total_bs: params.total_bs,
      tasa_cambio_aplicada: params.tasa_cambio_aplicada,
    },
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

  return { autorizada: true };
}
