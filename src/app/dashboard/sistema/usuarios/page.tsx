import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/auth/permisos";
import type { UsuarioListado } from "@/lib/types/database";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage() {
  await requerirPermiso("sistema.gestionar_usuarios");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // auth.users no se lee directo: la RPC es la única compuerta, y valida el
  // permiso otra vez del lado de la base.
  const { data: usuarios, error } = await supabase.rpc("listar_usuarios");

  if (error) {
    console.error("Error al listar usuarios:", error.message);
  }

  return (
    <UsuariosClient
      usuarios={(usuarios ?? []) as UsuarioListado[]}
      usuarioActualId={user?.id ?? null}
      errorCarga={error?.message ?? null}
    />
  );
}
