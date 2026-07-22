"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UnidadMedida, TipoMovimiento } from "@/lib/types/database";

// ──────────────────────────────────────────
// Productos
// ──────────────────────────────────────────

export async function crearProducto(formData: FormData) {
  const supabase = await createClient();

  const nombre = formData.get("nombre") as string;
  const sku = formData.get("sku") as string;
  const codigo_barras = (formData.get("codigo_barras") as string) || null;
  const descripcion = (formData.get("descripcion") as string) || null;
  const categoria_id = formData.get("categoria_id") as string;
  const proveedor_id = (formData.get("proveedor_id") as string) || null;
  const unidad_medida = formData.get("unidad_medida") as UnidadMedida;
  const precio_costo_usd = parseFloat(formData.get("precio_costo_usd") as string);
  const precio_venta_usd = parseFloat(formData.get("precio_venta_usd") as string);
  const stock_inicial = parseFloat(formData.get("stock_actual") as string);
  const stock_minimo = parseFloat(formData.get("stock_minimo") as string);

  // Validación server-side
  if (!nombre || !sku || !categoria_id || !unidad_medida) {
    return { error: "Campos obligatorios faltantes: nombre, SKU, categoría y unidad de medida." };
  }
  if (isNaN(precio_costo_usd) || precio_costo_usd < 0) {
    return { error: "Precio de costo inválido." };
  }
  if (isNaN(precio_venta_usd) || precio_venta_usd < 0) {
    return { error: "Precio de venta inválido." };
  }
  if (isNaN(stock_inicial) || stock_inicial < 0) {
    return { error: "Stock inicial inválido." };
  }

  // Verificar SKU único
  const { data: existingSku } = await supabase
    .from("productos")
    .select("id")
    .eq("sku", sku)
    .maybeSingle();

  if (existingSku) {
    return { error: `El SKU "${sku}" ya existe. Usa un SKU diferente.` };
  }

  // Insertar producto
  const { data: producto, error: insertError } = await supabase
    .from("productos")
    .insert({
      nombre,
      sku,
      codigo_barras,
      descripcion,
      categoria_id,
      proveedor_id: proveedor_id || null,
      unidad_medida,
      precio_costo_usd,
      precio_venta_usd,
      stock_actual: stock_inicial,
      stock_minimo,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creando producto:", insertError);
    return { error: `Error al crear el producto: ${insertError.message}` };
  }

  // Crear movimiento de inventario tipo "entrada" (stock inicial)
  // per 03-Flujo-App.md §3: Guardar → se crea el producto y un movimiento tipo "entrada inicial"
  if (stock_inicial > 0) {
    const { error: movError } = await supabase
      .from("movimientos_inventario")
      .insert({
        producto_id: producto.id,
        tipo: "entrada" as TipoMovimiento,
        cantidad: stock_inicial,
        motivo: "Stock inicial al crear producto",
      });

    if (movError) {
      console.error("Error creando movimiento inicial:", movError);
      // No retornamos error — el producto ya se creó
    }
  }

  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard");
  return { success: true, id: producto.id };
}

export async function actualizarProducto(id: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = formData.get("nombre") as string;
  const sku = formData.get("sku") as string;
  const codigo_barras = (formData.get("codigo_barras") as string) || null;
  const descripcion = (formData.get("descripcion") as string) || null;
  const categoria_id = formData.get("categoria_id") as string;
  const proveedor_id = (formData.get("proveedor_id") as string) || null;
  const unidad_medida = formData.get("unidad_medida") as UnidadMedida;
  const precio_costo_usd = parseFloat(formData.get("precio_costo_usd") as string);
  const precio_venta_usd = parseFloat(formData.get("precio_venta_usd") as string);
  const stock_minimo = parseFloat(formData.get("stock_minimo") as string);

  if (!nombre || !sku || !categoria_id || !unidad_medida) {
    return { error: "Campos obligatorios faltantes." };
  }

  // Verificar SKU único (excluyendo el producto actual)
  const { data: existingSku } = await supabase
    .from("productos")
    .select("id")
    .eq("sku", sku)
    .neq("id", id)
    .maybeSingle();

  if (existingSku) {
    return { error: `El SKU "${sku}" ya está en uso por otro producto.` };
  }

  const { error } = await supabase
    .from("productos")
    .update({
      nombre,
      sku,
      codigo_barras,
      descripcion,
      categoria_id,
      proveedor_id: proveedor_id || null,
      unidad_medida,
      precio_costo_usd,
      precio_venta_usd,
      stock_minimo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error actualizando producto:", error);
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath("/dashboard/inventario");
  revalidatePath(`/dashboard/inventario/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleActivoProducto(id: string, activo: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("productos")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: `Error al cambiar estado: ${error.message}` };
  }

  revalidatePath("/dashboard/inventario");
  revalidatePath(`/dashboard/inventario/${id}`);
  return { success: true };
}

// ──────────────────────────────────────────
// Movimientos de inventario
// ──────────────────────────────────────────

export async function registrarMovimiento(formData: FormData) {
  const supabase = await createClient();

  const producto_id = formData.get("producto_id") as string;
  const tipo = formData.get("tipo") as TipoMovimiento;
  const cantidad = parseFloat(formData.get("cantidad") as string);
  const motivo = (formData.get("motivo") as string) || null;

  // Validaciones — per 03-Flujo-App.md §4 y 05-Esquema-Backend.md §2
  if (!producto_id || !tipo) {
    return { error: "Producto y tipo de movimiento son obligatorios." };
  }
  if (isNaN(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser mayor a cero." };
  }
  // Motivo obligatorio en salidas y ajustes (per spec: "obligatorio si tipo = ajuste/salida manual")
  if ((tipo === "salida" || tipo === "ajuste") && !motivo?.trim()) {
    return { error: "El motivo es obligatorio para salidas y ajustes." };
  }

  // Obtener stock actual
  const { data: producto, error: fetchError } = await supabase
    .from("productos")
    .select("stock_actual, nombre")
    .eq("id", producto_id)
    .single();

  if (fetchError || !producto) {
    return { error: "Producto no encontrado." };
  }

  // Calcular nuevo stock
  let nuevoStock: number;
  if (tipo === "entrada") {
    nuevoStock = producto.stock_actual + cantidad;
  } else {
    // salida o ajuste → resta
    nuevoStock = producto.stock_actual - cantidad;
  }

  // Advertencia si stock < 0 (no bloquea — per 03-Flujo-App.md §8)
  const advertencia =
    nuevoStock < 0
      ? `⚠️ El stock de "${producto.nombre}" quedará en ${nuevoStock}. Se registró el movimiento.`
      : null;

  // Insertar movimiento
  const { error: movError } = await supabase
    .from("movimientos_inventario")
    .insert({
      producto_id,
      tipo,
      cantidad,
      motivo,
    });

  if (movError) {
    console.error("Error registrando movimiento:", movError);
    return { error: `Error al registrar movimiento: ${movError.message}` };
  }

  // Actualizar stock_actual
  const { error: updateError } = await supabase
    .from("productos")
    .update({
      stock_actual: nuevoStock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", producto_id);

  if (updateError) {
    console.error("Error actualizando stock:", updateError);
    return { error: `Movimiento registrado pero error al actualizar stock: ${updateError.message}` };
  }

  revalidatePath("/dashboard/inventario");
  revalidatePath(`/dashboard/inventario/${producto_id}`);
  revalidatePath("/dashboard");
  return { success: true, advertencia, nuevoStock };
}

// ──────────────────────────────────────────
// Helpers: generar SKU
// ──────────────────────────────────────────

const CATEGORIA_PREFIJOS: Record<string, string> = {
  plomería: "PLO",
  electricidad: "ELE",
  herramientas: "HER",
  pintura: "PIN",
  materiales: "MAT",
  "ferretería general": "FER",
};

export async function generarSku(categoriaNombre: string) {
  const supabase = await createClient();

  const prefijo =
    CATEGORIA_PREFIJOS[categoriaNombre.toLowerCase()] ||
    categoriaNombre.substring(0, 3).toUpperCase();

  // Contar productos existentes con ese prefijo
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .like("sku", `${prefijo}-%`);

  const secuencial = ((count ?? 0) + 1).toString().padStart(4, "0");
  return `${prefijo}-${secuencial}`;
}
