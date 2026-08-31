import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Verificación de permisos contra el kernel de la base de datos.
 *
 * Toda decisión de acceso se resuelve preguntándole a las RPCs
 * `tiene_permiso` / `mis_permisos` (migración 00027), nunca comparando
 * `profile.role` en TypeScript. El rol es un dato; el permiso efectivo es
 * el resultado de `rol_permisos`, que es configurable en caliente desde el
 * panel y por tanto no puede replicarse como constante en el frontend.
 *
 * Todas las funciones fallan CERRADAS: si la RPC devuelve error, el usuario
 * se trata como si no tuviera el permiso.
 */

/**
 * Permisos que dan acceso a alguna sub-ruta de /dashboard/sistema. Tener al
 * menos uno habilita el gate grueso del layout; cada página aplica después el
 * suyo.
 *
 * No es exactamente el grupo "Sistema" del catálogo: la cola de revisión
 * reutiliza `ventas.autorizar_stock_negativo` en vez de definir un permiso
 * propio, porque quien autoriza la excepción es quien responde por revisarla.
 * Si esta lista se derivara del grupo, esa página quedaría inalcanzable para
 * alguien que tuviera el permiso de revisión y ningún otro.
 */
export const PERMISOS_SISTEMA = [
  "sistema.ver_auditoria",
  "sistema.gestionar_usuarios",
  "sistema.asignar_roles",
  "ventas.autorizar_stock_negativo",
] as const;

/**
 * Todos los permisos del usuario en sesión, en una sola llamada.
 * Preferir sobre N llamadas a `tienePermiso` cuando hay que evaluar varios.
 */
export async function obtenerMisPermisos(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mis_permisos");

  if (error) {
    console.error("Error al obtener permisos del usuario:", error.message);
    return new Set();
  }

  return new Set(
    (data ?? []).map((fila: { permiso_codigo: string }) => fila.permiso_codigo)
  );
}

/** Verifica un permiso puntual del usuario en sesión. */
export async function tienePermiso(codigo: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tiene_permiso", {
    p_codigo: codigo,
  });

  if (error) {
    console.error(`Error al verificar el permiso "${codigo}":`, error.message);
    return false;
  }

  return data === true;
}

/**
 * Gate de ruta para Server Components: corta el render y redirige al
 * dashboard si el usuario no tiene el permiso.
 *
 * Esto es control de acceso real, no cosmético. Ocultar el enlace en el menú
 * no protege nada: la ruta sigue siendo alcanzable escribiendo la URL.
 */
export async function requerirPermiso(codigo: string): Promise<void> {
  if (!(await tienePermiso(codigo))) {
    redirect("/dashboard");
  }
}
