"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  configurarPermisoSchema,
  getZodErrorMessage,
} from "@/lib/schemas/actions-schemas";
import type { RolUsuario } from "@/lib/types/database";

/**
 * Otorga o revoca un permiso a un rol.
 *
 * Esta acción NO decide nada: solo valida la forma del payload y delega en la
 * RPC `asignar_permiso`, cuyo kernel (migración 00028) es la autoridad sobre
 * qué combinaciones son legales. Si la RPC rechaza, el error se propaga tal
 * cual al cliente — no hay camino alterno ni reintento.
 */
export async function configurarPermiso(
  rol: RolUsuario,
  permisoCodigo: string,
  activo: boolean
) {
  const parsed = configurarPermisoSchema.safeParse({
    rol,
    permiso_codigo: permisoCodigo,
    activo,
  });

  if (!parsed.success) {
    return { error: getZodErrorMessage(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("asignar_permiso", {
    p_rol: parsed.data.rol,
    p_permiso_codigo: parsed.data.permiso_codigo,
    p_activo: parsed.data.activo,
  });

  if (error) {
    console.error("Error en RPC asignar_permiso:", error.message);
    return { error: error.message };
  }

  revalidatePath("/dashboard/sistema/permisos");
  revalidatePath("/dashboard/sistema/auditoria");
  return { success: true };
}
