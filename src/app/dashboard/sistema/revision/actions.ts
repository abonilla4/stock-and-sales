"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  revisarAutorizacionOfflineSchema,
  getZodErrorMessage,
} from "@/lib/schemas/actions-schemas";
import type { ResultadoRevision } from "@/lib/types/database";

/**
 * Registra el dictamen sobre una venta autorizada offline.
 *
 * No toca `ventas`: la RPC solo inserta en `revisiones_autorizacion`. La venta
 * queda tal como se registró, que es lo correcto — es un snapshot del momento.
 *
 * Si la RPC falla, el error se propaga sin reintento ni camino alterno.
 */
export async function revisarAutorizacionOffline(
  ventaId: string,
  resultado: ResultadoRevision,
  notas: string | null
) {
  const parsed = revisarAutorizacionOfflineSchema.safeParse({
    venta_id: ventaId,
    resultado,
    notas,
  });

  if (!parsed.success) {
    return { error: getZodErrorMessage(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("revisar_autorizacion_offline", {
    p_venta_id: parsed.data.venta_id,
    p_resultado: parsed.data.resultado,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) {
    console.error("Error en RPC revisar_autorizacion_offline:", error.message);
    return { error: error.message };
  }

  revalidatePath("/dashboard/sistema/revision");
  revalidatePath("/dashboard/sistema/auditoria");
  return { success: true };
}
