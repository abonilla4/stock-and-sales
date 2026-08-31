import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/auth/permisos";
import type { RevisionAutorizacion } from "@/lib/types/database";
import { RevisionClient, type VentaOffline } from "./revision-client";

export default async function RevisionPage() {
  // Mismo permiso que autoriza la excepción en caliente: quien puede
  // autorizarla es quien responde por revisar las que se autorizaron sin él.
  await requerirPermiso("ventas.autorizar_stock_negativo");

  const supabase = await createClient();

  // Ventas que se sincronizaron desde la cola offline sin un administrador
  // que las autorizara en el momento (migración 00011).
  const { data: ventas, error: errorVentas } = await supabase
    .from("ventas")
    .select(
      "id, fecha, total_usd, total_bs, tasa_cambio_aplicada, metodo_pago, motivos_autorizacion, cliente_id, clientes(nombre)"
    )
    .eq("origen_autorizacion", "offline_diferido")
    .is("autorizado_por", null)
    .order("fecha", { ascending: false });

  if (errorVentas) {
    console.error("Error al cargar ventas offline:", errorVentas.message);
  }

  // Las revisiones se traen aparte y se cruzan en memoria: el conjunto es
  // pequeño y evita depender de cómo PostgREST resuelva el embedding.
  const { data: revisiones, error: errorRevisiones } = await supabase
    .from("revisiones_autorizacion")
    .select("id, venta_id, revisado_por, resultado, notas, created_at");

  if (errorRevisiones) {
    console.error("Error al cargar revisiones:", errorRevisiones.message);
  }

  const revisionPorVenta = new Map<string, RevisionAutorizacion>(
    (revisiones ?? []).map((r) => [r.venta_id, r as RevisionAutorizacion])
  );

  const filas: VentaOffline[] = (ventas ?? []).map((venta) => {
    const cliente = Array.isArray(venta.clientes)
      ? venta.clientes[0]
      : venta.clientes;

    return {
      id: venta.id,
      fecha: venta.fecha,
      total_usd: venta.total_usd,
      total_bs: venta.total_bs,
      metodo_pago: venta.metodo_pago,
      motivos_autorizacion: venta.motivos_autorizacion,
      cliente_nombre: cliente?.nombre ?? null,
      revision: revisionPorVenta.get(venta.id) ?? null,
    };
  });

  return (
    <RevisionClient
      pendientes={filas.filter((f) => f.revision === null)}
      revisadas={filas.filter((f) => f.revision !== null)}
      errorCarga={(errorVentas ?? errorRevisiones)?.message ?? null}
    />
  );
}
