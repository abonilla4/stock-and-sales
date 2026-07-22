"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCategoria(formData: FormData) {
  const supabase = await createClient();

  const nombre = (formData.get("nombre") as string)?.trim();
  const descripcion = (formData.get("descripcion") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre de la categoría es obligatorio." };
  }

  // Verificar duplicado
  const { data: existing } = await supabase
    .from("categorias")
    .select("id")
    .ilike("nombre", nombre)
    .maybeSingle();

  if (existing) {
    return { error: `Ya existe una categoría con el nombre "${nombre}".` };
  }

  const { error } = await supabase
    .from("categorias")
    .insert({ nombre, descripcion });

  if (error) {
    console.error("Error creando categoría:", error);
    return { error: `Error al crear la categoría: ${error.message}` };
  }

  revalidatePath("/dashboard/configuracion/categorias");
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function actualizarCategoria(id: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = (formData.get("nombre") as string)?.trim();
  const descripcion = (formData.get("descripcion") as string)?.trim() || null;

  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }

  // Verificar duplicado excluyendo la actual
  const { data: existing } = await supabase
    .from("categorias")
    .select("id")
    .ilike("nombre", nombre)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    return { error: `Ya existe otra categoría con el nombre "${nombre}".` };
  }

  const { error } = await supabase
    .from("categorias")
    .update({ nombre, descripcion })
    .eq("id", id);

  if (error) {
    return { error: `Error al actualizar: ${error.message}` };
  }

  revalidatePath("/dashboard/configuracion/categorias");
  revalidatePath("/dashboard/inventario");
  return { success: true };
}

export async function eliminarCategoria(id: string) {
  const supabase = await createClient();

  // Verificar que no tiene productos asociados
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: esta categoría tiene ${count} producto(s) asociado(s). Reasígnalos primero.`,
    };
  }

  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: `Error al eliminar: ${error.message}` };
  }

  revalidatePath("/dashboard/configuracion/categorias");
  return { success: true };
}
