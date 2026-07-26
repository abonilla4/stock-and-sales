"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearProveedorSchema, getZodErrorMessage } from "@/lib/schemas/actions-schemas";

export async function crearProveedor(formData: FormData) {
  const rawData = {
    nombre: (formData.get("nombre") as string)?.trim(),
    codigo: (formData.get("codigo") as string)?.trim() || null,
    telefono: (formData.get("telefono") as string)?.trim() || null,
    contacto: (formData.get("contacto") as string)?.trim() || null,
    notas: (formData.get("notas") as string)?.trim() || null,
  };

  const parseResult = crearProveedorSchema.safeParse(rawData);
  if (!parseResult.success) {
    return { error: getZodErrorMessage(parseResult.error) };
  }

  const { nombre, telefono, contacto, notas } = parseResult.data;
  let { codigo } = parseResult.data;

  const supabase = await createClient();

  // Verificar que no exista otro proveedor con el mismo nombre (case-insensitive)
  const { data: existente } = await supabase
    .from("proveedores")
    .select("id")
    .ilike("nombre", nombre)
    .limit(1);

  if (existente && existente.length > 0) {
    return { error: `Ya existe un proveedor registrado con el nombre "${nombre}".` };
  }

  // Si no ingresó código, autogenerar uno aleatorio tipo PRV-XXXX
  if (!codigo) {
    codigo = `PRV-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const { error } = await supabase
    .from("proveedores")
    .insert({ codigo, nombre, telefono, contacto, notas });

  if (error) {
    console.error("Error creando proveedor:", error);
    // Capturar violación de unicidad en BD (índice único o carrera concurrente)
    if (
      error.code === "23505" ||
      error.message.includes("proveedores_nombre_unique_ci") ||
      error.message.includes("unique constraint") ||
      error.message.includes("duplicate key")
    ) {
      return { error: `Ya existe un proveedor registrado con el nombre "${nombre}".` };
    }

    // Si la columna codigo no existe en la tabla postgres aún, reintentar sin código
    if (error.message.includes("codigo") || error.code === "PGRST204") {
      const { error: retryError } = await supabase
        .from("proveedores")
        .insert({ nombre, telefono, contacto, notas });
      if (retryError) {
        if (
          retryError.code === "23505" ||
          retryError.message.includes("proveedores_nombre_unique_ci") ||
          retryError.message.includes("unique constraint") ||
          retryError.message.includes("duplicate key")
        ) {
          return { error: `Ya existe un proveedor registrado con el nombre "${nombre}".` };
        }
        return { error: `Error al crear el proveedor: ${retryError.message}` };
      }
    } else {
      return { error: `Error al crear el proveedor: ${error.message}` };
    }
  }

  revalidatePath("/dashboard/configuracion/proveedores");
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function actualizarProveedor(id: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = (formData.get("nombre") as string)?.trim();
  const codigo = (formData.get("codigo") as string)?.trim() || null;
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const contacto = (formData.get("contacto") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }

  // Verificar que no exista otro proveedor con el mismo nombre (case-insensitive)
  const { data: existente } = await supabase
    .from("proveedores")
    .select("id")
    .ilike("nombre", nombre)
    .neq("id", id)
    .limit(1);

  if (existente && existente.length > 0) {
    return { error: `Ya existe otro proveedor registrado con el nombre "${nombre}".` };
  }

  const { error } = await supabase
    .from("proveedores")
    .update({ codigo, nombre, telefono, contacto, notas })
    .eq("id", id);

  if (error) {
    console.error("Error actualizando proveedor:", error);
    // Capturar violación de unicidad en BD (índice único o carrera concurrente)
    if (
      error.code === "23505" ||
      error.message.includes("proveedores_nombre_unique_ci") ||
      error.message.includes("unique constraint") ||
      error.message.includes("duplicate key")
    ) {
      return { error: `Ya existe otro proveedor registrado con el nombre "${nombre}".` };
    }

    if (error.message.includes("codigo") || error.code === "PGRST204") {
      const { error: retryError } = await supabase
        .from("proveedores")
        .update({ nombre, telefono, contacto, notas })
        .eq("id", id);
      if (retryError) {
        if (
          retryError.code === "23505" ||
          retryError.message.includes("proveedores_nombre_unique_ci") ||
          retryError.message.includes("unique constraint") ||
          retryError.message.includes("duplicate key")
        ) {
          return { error: `Ya existe otro proveedor registrado con el nombre "${nombre}".` };
        }
        return { error: `Error al actualizar: ${retryError.message}` };
      }
    } else {
      return { error: `Error al actualizar: ${error.message}` };
    }
  }

  revalidatePath("/dashboard/configuracion/proveedores");
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function eliminarProveedor(id: string) {
  const supabase = await createClient();

  // Verificar que no tiene productos asociados
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("proveedor_id", id);

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: este proveedor tiene ${count} producto(s) asociado(s). Reasígnalos primero.`,
    };
  }

  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath("/dashboard/configuracion/proveedores");
  return { success: true };
}
