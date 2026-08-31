import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerMisPermisos, PERMISOS_SISTEMA } from "@/lib/auth/permisos";

/**
 * Gate grueso del panel de sistema.
 *
 * Resuelve los permisos una sola vez para todo el subárbol y descarta a quien
 * no tenga ninguno del grupo "Sistema". El gate fino —qué sub-ruta concreta
 * puede ver— lo aplica cada `page.tsx` con su propio `requerirPermiso(...)`,
 * porque las sub-rutas no comparten permiso: la auditoría la ve un admin,
 * pero la matriz de permisos y la gestión de usuarios son exclusivas del
 * desarrollador.
 *
 * Mientras la reescritura de RLS siga pendiente, este gate es la única
 * barrera real: las políticas de las tablas de negocio todavía autorizan a
 * cualquier usuario autenticado.
 */
export default async function SistemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const permisos = await obtenerMisPermisos();
  const tieneAccesoAlPanel = PERMISOS_SISTEMA.some((codigo) =>
    permisos.has(codigo)
  );

  if (!tieneAccesoAlPanel) {
    redirect("/dashboard");
  }

  return <div className="space-y-6">{children}</div>;
}
