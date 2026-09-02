import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/auth/permisos";
import {
  AUDITORIA_FILAS_POR_PAGINA,
  AUDITORIA_MAX_FILAS_MUESTRA_ACCIONES,
} from "@/lib/config/limites";
import type { RegistroAuditoria } from "@/lib/types/database";
import { AuditoriaClient } from "./auditoria-client";

type FiltroExito = "todos" | "exitosos" | "fallidos";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    accion?: string;
    exito?: string;
    desde?: string;
    hasta?: string;
    pagina?: string;
  }>;
}) {
  await requerirPermiso("sistema.ver_auditoria");

  const supabase = await createClient();
  const params = await searchParams;

  const accion = params.accion ?? "";
  const exito: FiltroExito =
    params.exito === "exitosos" || params.exito === "fallidos"
      ? params.exito
      : "todos";
  const desde = params.desde ?? "";
  const hasta = params.hasta ?? "";
  const pagina = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);

  const primeraFila = (pagina - 1) * AUDITORIA_FILAS_POR_PAGINA;

  let consulta = supabase
    .from("registro_auditoria")
    .select(
      "id, usuario_id, email, solicitante_id, accion, exito, detalle, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(primeraFila, primeraFila + AUDITORIA_FILAS_POR_PAGINA - 1);

  if (accion) {
    consulta = consulta.eq("accion", accion);
  }

  if (exito !== "todos") {
    consulta = consulta.eq("exito", exito === "exitosos");
  }

  if (desde) {
    consulta = consulta.gte("created_at", `${desde}T00:00:00`);
  }

  if (hasta) {
    // Fin de día inclusivo: el usuario elige un día, no un instante.
    consulta = consulta.lte("created_at", `${hasta}T23:59:59.999`);
  }

  const { data: eventos, error, count } = await consulta;

  if (error) {
    console.error("Error al consultar el registro de auditoría:", error.message);
  }

  // Acciones presentes en la tabla, para poblar el filtro sin hardcodear una
  // lista que quedaría desactualizada al agregar eventos nuevos.
  const { data: muestraAcciones } = await supabase
    .from("registro_auditoria")
    .select("accion")
    .order("created_at", { ascending: false })
    .limit(AUDITORIA_MAX_FILAS_MUESTRA_ACCIONES);

  const accionesDisponibles = [
    ...new Set((muestraAcciones ?? []).map((fila) => fila.accion)),
  ].sort();

  return (
    <AuditoriaClient
      eventos={(eventos ?? []) as RegistroAuditoria[]}
      accionesDisponibles={accionesDisponibles}
      total={count ?? 0}
      pagina={pagina}
      filasPorPagina={AUDITORIA_FILAS_POR_PAGINA}
      filtros={{ accion, exito, desde, hasta }}
      errorCarga={error?.message ?? null}
    />
  );
}
