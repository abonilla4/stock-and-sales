"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearProveedor(formData: FormData) {
  const supabase = await createClient();

  const nombre = (formData.get("nombre") as string)?.trim();
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const contacto = (formData.get("contacto") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre del proveedor es obligatorio." };
  }

  const { error } = await supabase
    .from("proveedores")
    .insert({ nombre, telefono, contacto, notas });

  if (error) {
    console.error("Error creando proveedor:", error);
    return { error: `Error al crear el proveedor: ${error.message}` };
  }

  revalidatePath("/dashboard/configuracion/proveedores");
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function actualizarProveedor(id: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = (formData.get("nombre") as string)?.trim();
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const contacto = (formData.get("contacto") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }

  const { error } = await supabase
    .from("proveedores")
    .update({ nombre, telefono, contacto, notas })
    .eq("id", id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
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
