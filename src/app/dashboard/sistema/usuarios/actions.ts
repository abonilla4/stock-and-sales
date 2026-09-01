"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/auth/permisos";
import {
  crearUsuarioSchema,
  cambiarRolUsuarioSchema,
  cambiarEstadoUsuarioSchema,
  getZodErrorMessage,
} from "@/lib/schemas/actions-schemas";
import type { RolUsuario } from "@/lib/types/database";

/**
 * Gestión de usuarios — Fase 3.
 *
 * REGLA DE ORO DE ESTE ARCHIVO: `createAdminClient()` usa la Service Role Key
 * y se salta RLS por completo. Una Server Action es invocable directamente por
 * cualquiera con sesión, así que proteger la ruta NO alcanza: cada acción que
 * toque el cliente administrativo verifica el permiso ella misma, antes de
 * instanciarlo. Sin esa verificación, un cajero podría crearse un usuario.
 *
 * El cliente administrativo se usa para dos cosas y ninguna más:
 *   1. `auth.admin.*` — crear, banear y reactivar cuentas.
 *   2. El INSERT en `registro_auditoria`, porque su política ya no admite
 *      escritura directa de `authenticated` y reabrirla permitiría que
 *      cualquier usuario fabricara o borrara eventos.
 *
 * NUNCA para tablas de negocio (ventas, productos, clientes, stock): ahí una
 * consulta con Service Role se saltaría RLS y anularía el modelo de permisos.
 * Los cambios de rol siguen yendo por `asignar_rol` con el cliente de sesión,
 * para que `auth.uid()` sea el actor real dentro de la RPC.
 */

/** 100 años. Supabase Auth no tiene "desactivado", solo baneo con vencimiento. */
const BAN_INDEFINIDO = "876000h";

async function verificarPermisoGestion(): Promise<string | null> {
  if (!(await tienePermiso("sistema.gestionar_usuarios"))) {
    return "No autorizado: se requiere el permiso sistema.gestionar_usuarios.";
  }
  return null;
}

/**
 * Registra en auditoría acciones que ocurren en Auth y no tienen RPC propia.
 *
 * Devuelve un mensaje de advertencia si el registro falló, en vez de tragarse
 * el error. La mutación en Auth ya ocurrió y no se puede deshacer, así que
 * devolver `{ success: true }` a secas dejaría un alta o una baja de usuario
 * sin rastro y sin que nadie se entere — que es exactamente lo contrario de
 * para lo que existe esta tabla.
 *
 * Los cambios de rol no pasan por aquí: su auditoría vive dentro de
 * `asignar_rol`, en la misma transacción, así que si el INSERT falla el
 * cambio de rol se revierte entero.
 */
async function registrarEnAuditoria(
  accion: string,
  exito: boolean,
  detalle: string
): Promise<string | null> {
  // La identidad del actor sale SIEMPRE de la sesión de cookies: es quien
  // realmente ejecutó la acción. El cliente administrativo no tiene identidad
  // propia y usarlo para esto escribiría auditoría anónima.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El INSERT sí va por el cliente administrativo. La política de
  // registro_auditoria ya no admite escritura directa de `authenticated`, y
  // reabrirla dejaría que cualquier usuario fabrique o borre eventos. El
  // camino correcto es que solo el servidor escriba, con la fila apuntando al
  // actor real.
  //
  // ⚠️ ESTO SE SALTA RLS. Toda ruta que llegue aquí debe haber verificado ya
  // el permiso del actor — ver verificarPermisoGestion(). El helper es privado
  // del módulo a propósito: no se exporta, para que no pueda invocarse desde
  // una acción nueva sin ese control y convertirse en un vector de falsificación
  // de auditoría.
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("No se pudo crear el cliente administrativo para auditar:", e);
    return "La operación se completó, pero NO quedó registrada en auditoría: falta la clave de servicio en el servidor. Anótala manualmente.";
  }

  const { error } = await admin.from("registro_auditoria").insert({
    usuario_id: user?.id ?? null,
    email: user?.email ?? null,
    accion,
    exito,
    detalle,
  });

  if (error) {
    console.error("No se pudo registrar el evento en auditoría:", error.message);
    return `La operación se completó, pero NO quedó registrada en auditoría (${error.message}). Anótala manualmente y revisa por qué falló el registro.`;
  }

  return null;
}

export async function crearUsuario(
  email: string,
  password: string,
  rol: RolUsuario
) {
  const parsed = crearUsuarioSchema.safeParse({ email, password, rol });
  if (!parsed.success) {
    return { error: getZodErrorMessage(parsed.error) };
  }

  const sinPermiso = await verificarPermisoGestion();
  if (sinPermiso) return { error: sinPermiso };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("No se pudo crear el cliente administrativo:", e);
    return {
      error:
        "El servidor no tiene configurada la clave de servicio. Revisa SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("Error al crear usuario en Auth:", error?.message);
    await registrarEnAuditoria(
      "USUARIO_CREADO",
      false,
      `Fallo al crear ${parsed.data.email}: ${error?.message ?? "sin datos de usuario"}`
    );
    return {
      error: `No se pudo crear el usuario: ${error?.message ?? "error desconocido"}`,
    };
  }

  const nuevoUsuarioId = data.user.id;

  // El trigger de alta crea el profile con el rol por defecto, que hoy es
  // 'admin'. Se llama asignar_rol SIEMPRE, incluso cuando el rol pedido
  // coincide con ese default: deja el rol explícito, genera la fila de
  // auditoría, y evita tener que tocar este código cuando la Fase 5 cambie el
  // default a 'cajero'.
  const supabase = await createClient();
  const { error: errorRol } = await supabase.rpc("asignar_rol", {
    p_usuario_id: nuevoUsuarioId,
    p_rol: parsed.data.rol,
  });

  if (errorRol) {
    // No hay transacción entre Auth y Postgres. Si el rol no se pudo fijar, el
    // usuario quedaría con el rol por defecto — hoy 'admin', es decir más
    // privilegios de los pedidos. Se desactiva de inmediato en vez de dejarlo
    // vivo, y se reporta el fallo tal cual.
    console.error(
      "Error al asignar rol al usuario recién creado:",
      errorRol.message
    );
    await admin.auth.admin.updateUserById(nuevoUsuarioId, {
      ban_duration: BAN_INDEFINIDO,
    });
    await registrarEnAuditoria(
      "USUARIO_CREADO",
      false,
      `Usuario ${parsed.data.email} creado pero sin rol asignado (${errorRol.message}). Se desactivó por seguridad.`
    );
    return {
      error: `El usuario se creó pero no se le pudo asignar el rol (${errorRol.message}). Se desactivó por seguridad; revísalo antes de reintentar.`,
    };
  }

  const advertencia = await registrarEnAuditoria(
    "USUARIO_CREADO",
    true,
    `Usuario ${parsed.data.email} creado con rol ${parsed.data.rol}`
  );

  revalidatePath("/dashboard/sistema/usuarios");
  revalidatePath("/dashboard/sistema/auditoria");
  return { success: true, advertencia };
}

export async function cambiarRolUsuario(usuarioId: string, rol: RolUsuario) {
  const parsed = cambiarRolUsuarioSchema.safeParse({
    usuario_id: usuarioId,
    rol,
  });
  if (!parsed.success) {
    return { error: getZodErrorMessage(parsed.error) };
  }

  // Sin cliente administrativo: asignar_rol ya valida el actor, el autoservicio
  // y la protección del rol desarrollador dentro de la propia RPC (00028).
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_rol", {
    p_usuario_id: parsed.data.usuario_id,
    p_rol: parsed.data.rol,
  });

  if (error) {
    console.error("Error en RPC asignar_rol:", error.message);
    return { error: error.message };
  }

  revalidatePath("/dashboard/sistema/usuarios");
  revalidatePath("/dashboard/sistema/auditoria");
  return { success: true };
}

export async function cambiarEstadoUsuario(usuarioId: string, activo: boolean) {
  const parsed = cambiarEstadoUsuarioSchema.safeParse({
    usuario_id: usuarioId,
    activo,
  });
  if (!parsed.success) {
    return { error: getZodErrorMessage(parsed.error) };
  }

  const sinPermiso = await verificarPermisoGestion();
  if (sinPermiso) return { error: sinPermiso };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth no tiene las salvaguardas que asignar_rol sí trae para los roles, así
  // que hay que replicarlas: sin auto-bloqueo y sin tocar a un desarrollador.
  if (user?.id === parsed.data.usuario_id) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }

  const { data: perfilObjetivo, error: errorPerfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", parsed.data.usuario_id)
    .single();

  if (errorPerfil || !perfilObjetivo) {
    return { error: "No se encontró el usuario indicado." };
  }

  if (perfilObjetivo.role === "desarrollador") {
    return {
      error:
        "No se puede desactivar a un desarrollador desde la aplicación: es el ancla de confianza del sistema.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("No se pudo crear el cliente administrativo:", e);
    return {
      error:
        "El servidor no tiene configurada la clave de servicio. Revisa SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(
    parsed.data.usuario_id,
    { ban_duration: parsed.data.activo ? "none" : BAN_INDEFINIDO }
  );

  const accion = parsed.data.activo
    ? "USUARIO_REACTIVADO"
    : "USUARIO_DESACTIVADO";

  if (error) {
    console.error("Error al cambiar el estado del usuario:", error.message);
    await registrarEnAuditoria(
      accion,
      false,
      `Fallo sobre ${parsed.data.usuario_id}: ${error.message}`
    );
    return { error: `No se pudo cambiar el estado del usuario: ${error.message}` };
  }

  const advertencia = await registrarEnAuditoria(
    accion,
    true,
    `Usuario ${parsed.data.usuario_id} ${parsed.data.activo ? "reactivado" : "desactivado"}`
  );

  revalidatePath("/dashboard/sistema/usuarios");
  revalidatePath("/dashboard/sistema/auditoria");
  return { success: true, advertencia };
}
