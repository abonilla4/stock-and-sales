import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/auth/permisos";
import type { Permiso, RolPermiso } from "@/lib/types/database";
import { PermisosClient } from "./permisos-client";

export default async function PermisosPage() {
  await requerirPermiso("sistema.asignar_roles");

  const supabase = await createClient();

  const [{ data: permisos, error: errorPermisos }, { data: asignaciones, error: errorAsignaciones }] =
    await Promise.all([
      supabase
        .from("permisos")
        .select("codigo, descripcion, grupo, es_critico, orden")
        .order("orden"),
      supabase.from("rol_permisos").select("rol, permiso_codigo"),
    ]);

  const error = errorPermisos ?? errorAsignaciones;
  if (error) {
    console.error("Error al cargar la matriz de permisos:", error.message);
  }

  return (
    <PermisosClient
      permisos={(permisos ?? []) as Permiso[]}
      asignaciones={(asignaciones ?? []) as Pick<RolPermiso, "rol" | "permiso_codigo">[]}
      errorCarga={error?.message ?? null}
    />
  );
}
