"use server";

import { revalidatePath } from "next/cache";
import { createClient, getPerfil } from "@/lib/supabase/server";
import type { TasaCambio } from "@/lib/types/database";

/**
 * Obtener la tasa de cambio activa más reciente.
 * Retorna null si aún no se ha registrado ninguna tasa.
 */
export async function obtenerTasaActiva(): Promise<TasaCambio | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasas_cambio")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener la tasa de cambio activa:", error);
    return null;
  }

  return data as TasaCambio | null;
}

/**
 * Registrar una nueva tasa de cambio manual (Append-Only per 05-Esquema-Backend.md §2).
 * Solo usuarios autenticados (o Admin per sk_frontend-desarrollo).
 */
export async function registrarTasaCambio(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Usuario no autenticado." };
  }

  // Verificar rol de Administrador para modificar la tasa
  const perfil = await getPerfil();
  if (perfil?.role !== "admin") {
    return { error: "Solo un usuario con rol Administrador puede actualizar la tasa de cambio." };
  }

  const tasaRaw = formData.get("tasa") as string;
  const tasaNum = parseFloat(tasaRaw);

  if (isNaN(tasaNum) || tasaNum <= 0) {
    return { error: "Por favor ingresa una tasa de cambio válida mayor a 0 (Bs / USD)." };
  }

  // Append-only: INSERT de nueva fila
  const { error: insertError } = await supabase.from("tasas_cambio").insert({
    tasa: tasaNum,
    fuente: "manual",
    fecha: new Date().toISOString(),
  });

  if (insertError) {
    console.error("Error al registrar nueva tasa de cambio:", insertError);
    return { error: "Error de base de datos al registrar la tasa de cambio." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/configuracion/tasa-cambio");

  return { success: true };
}

/**
 * Obtener el historial completo de tasas de cambio registradas.
 */
export async function obtenerHistorialTasas(): Promise<TasaCambio[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasas_cambio")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener el historial de tasas:", error);
    return [];
  }

  return (data ?? []) as TasaCambio[];
}
