import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Clientes de Supabase que NO participan de la sesión del usuario.
 *
 * Los clientes con cookies viven en client.ts, server.ts y middleware.ts.
 * Los dos de este archivo son deliberadamente distintos: ninguno lee ni
 * escribe cookies, porque ambos operan sobre una identidad que no es la del
 * usuario en sesión.
 *
 * `import "server-only"` es la primera línea a propósito: si alguien importa
 * este módulo desde un componente `"use client"`, el build debe romperse antes
 * de que la Service Role Key llegue jamás al bundle del navegador.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Sin sesión persistida: estos clientes son de un solo uso, por petición. */
const SIN_SESION = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * Cliente con Service Role Key — omite RLS por completo.
 *
 * USO EXCLUSIVO: operaciones `auth.admin.*` (crear usuario, banear, resetear
 * contraseña). Nunca para queries de negocio: una consulta a `ventas` o
 * `productos` con esta clave se saltaría todas las políticas RLS y anularía
 * el modelo de permisos completo.
 *
 * La variable NO lleva prefijo `NEXT_PUBLIC_` y debe estar marcada solo para
 * Runtime en Vercel.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL: no se puede crear el cliente administrativo."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY: no se puede crear el cliente administrativo. " +
        "Debe definirse sin prefijo NEXT_PUBLIC_ y solo en el entorno de Runtime."
    );
  }

  return createSupabaseClient(SUPABASE_URL, serviceRoleKey, SIN_SESION);
}

/**
 * Cliente efímero con la anon key.
 *
 * USO EXCLUSIVO: validar las credenciales de un usuario que NO es el de la
 * sesión actual (autorización delegada, Fase 4). Al no persistir sesión, un
 * `signInWithPassword` sobre este cliente valida la contraseña sin reescribir
 * las cookies del usuario que está operando la caja.
 *
 * Es lo que evita el bug actual de `autorizarVentaAdmin`, donde autenticar al
 * administrador reemplaza la sesión del cajero.
 */
export function createEphemeralClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY: no se puede crear el cliente efímero."
    );
  }

  return createSupabaseClient(SUPABASE_URL, anonKey, SIN_SESION);
}
