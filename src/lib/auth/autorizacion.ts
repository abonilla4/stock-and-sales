import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createEphemeralClient } from "@/lib/supabase/admin";

/**
 * Autorización delegada: un administrador autoriza una excepción sin desplazar
 * al usuario que está operando la caja.
 *
 * EL BUG QUE ESTO CORRIGE. El flujo anterior llamaba `signInWithPassword`
 * sobre el cliente de servidor, que escribe cookies: autenticar al admin
 * REEMPLAZABA la sesión del cajero. A partir de ahí `auth.uid()` era el admin,
 * de modo que la venta quedaba registrada como si la hubiera hecho él y el
 * cajero terminaba operando con privilegios que no le corresponden. Aquí las
 * credenciales se validan contra un cliente efímero sin cookies, y la sesión
 * de quien opera nunca se toca.
 *
 * ESTA FUNCIÓN NO EJECUTA LA ACCIÓN DE NEGOCIO. Solo responde quién autorizó.
 * Quien la llama ejecuta la RPC correspondiente en la misma Server Action, sin
 * token intermedio: no existe una "autorización" persistida que alguien pueda
 * reutilizar más tarde.
 */

export interface ResultadoAutorizacion {
  ok: boolean;
  /** uuid del administrador que autorizó. Solo presente cuando ok = true. */
  autorizadoPor?: string;
  error?: string;
  /** true cuando el rate limit cortó el intento, para que la UI lo distinga. */
  bloqueado?: boolean;
}

interface ParametrosAutorizacion {
  /**
   * Todos deben cumplirse. Una venta con stock insuficiente Y descuento
   * excesivo exige que el autorizador tenga los dos permisos: son excepciones
   * distintas y el catálogo las separa a propósito.
   */
  permisosRequeridos: string[];
  credenciales: { email: string; password: string };
}

export async function autorizarAccion({
  permisosRequeridos,
  credenciales,
}: ParametrosAutorizacion): Promise<ResultadoAutorizacion> {
  if (permisosRequeridos.length === 0) {
    return { ok: false, error: "No se indicó qué permiso hay que autorizar." };
  }

  const email = credenciales.email.trim().toLowerCase();
  if (!email || !credenciales.password) {
    return { ok: false, error: "Ingresa el correo y la contraseña del autorizador." };
  }

  // 1. Identidad del solicitante — de las cookies, nunca del cliente.
  const supabase = await createClient();
  const {
    data: { user: solicitante },
  } = await supabase.auth.getUser();

  if (!solicitante) {
    return { ok: false, error: "No hay una sesión activa. Vuelve a iniciar sesión." };
  }

  // 2. Validar credenciales del autorizador en un cliente aparte, sin cookies.
  let efimero;
  try {
    efimero = createEphemeralClient();
  } catch (e) {
    console.error("No se pudo crear el cliente efímero:", e);
    return { ok: false, error: "El servidor no está configurado para validar autorizaciones." };
  }

  let autorizadorId: string | null = null;
  try {
    const { data, error } = await efimero.auth.signInWithPassword({
      email,
      password: credenciales.password,
    });
    autorizadorId = error ? null : (data.user?.id ?? null);

    // 3. Permisos del autorizador. Se consultan con el cliente de SESIÓN, no
    //    con el efímero: `tiene_permiso_para` recibe el uuid explícito, así que
    //    no necesita que el autorizador sea auth.uid(), y usar la sesión del
    //    solicitante mantiene la consulta dentro de sus propios privilegios.
    let tieneTodos = false;
    if (autorizadorId) {
      tieneTodos = true;
      for (const permiso of permisosRequeridos) {
        const { data: permitido, error: errorPermiso } = await supabase.rpc(
          "tiene_permiso_para",
          { p_usuario_id: autorizadorId, p_codigo: permiso }
        );
        if (errorPermiso) {
          console.error(`Error al verificar "${permiso}":`, errorPermiso.message);
          tieneTodos = false;
          break;
        }
        if (permitido !== true) {
          tieneTodos = false;
          break;
        }
      }
    }

    const exito = autorizadorId !== null && tieneTodos;

    // 4. Rate limit + registro, atómico y por los dos ejes.
    const { data: limite, error: errorLimite } = await supabase.rpc(
      "verificar_y_registrar_intento_autorizacion",
      {
        p_solicitante_id: solicitante.id,
        p_email_autorizador: email,
        p_permiso: permisosRequeridos.join(", "),
        p_exito: exito,
        // Null cuando las credenciales no resolvieron a ningún usuario: en un
        // intento fallido no hay autorizador que identificar, solo un correo
        // tecleado. La fila queda con usuario_id NULL y email presente.
        p_autorizador_id: autorizadorId,
      }
    );

    if (errorLimite) {
      // Si no se puede registrar el intento, no se autoriza. Conceder una
      // excepción sin dejar rastro es peor que rechazarla.
      console.error("Error en el rate limit de autorización:", errorLimite.message);
      return { ok: false, error: "No se pudo registrar el intento de autorización. Inténtalo de nuevo." };
    }

    if (limite?.bloqueado) {
      return {
        ok: false,
        bloqueado: true,
        error: limite.mensaje ?? "Demasiados intentos fallidos. Espera 5 minutos.",
      };
    }

    if (!exito) {
      const restantes = limite?.intentos_restantes ?? 0;
      // Mensaje deliberadamente igual para credenciales inválidas y para
      // permisos insuficientes: distinguirlos revelaría qué correos existen y
      // cuáles pueden autorizar.
      return {
        ok: false,
        error: `No se pudo autorizar con esas credenciales. Intentos restantes: ${restantes}.`,
      };
    }

    return { ok: true, autorizadoPor: autorizadorId! };
  } finally {
    // 5. Descartar el cliente efímero. El signIn abrió una sesión del lado del
    //    servidor de Auth aunque no se haya persistido ninguna cookie; cerrarla
    //    evita dejar refresh tokens vivos por cada autorización concedida.
    try {
      await efimero.auth.signOut();
    } catch {
      // Best-effort: no convierte en fallo una autorización ya concedida.
    }
  }
}
