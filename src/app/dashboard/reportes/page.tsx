import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportesClient } from "./reportes-client";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";

export default async function ReportesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tasaActivaData = await obtenerTasaActiva();
  const tasaActiva = tasaActivaData?.tasa ?? 0;

  return <ReportesClient tasaActiva={tasaActiva} />;
}
