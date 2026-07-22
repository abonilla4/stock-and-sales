import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./clientes-client";
import { obtenerClientes } from "./actions";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";

export default async function ClientesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [clientes, tasaActivaData] = await Promise.all([
    obtenerClientes(""),
    obtenerTasaActiva(),
  ]);

  const tasaActiva = tasaActivaData?.tasa ?? 0;

  return (
    <ClientesClient
      clientesIniciales={clientes}
      tasaActiva={tasaActiva}
    />
  );
}
