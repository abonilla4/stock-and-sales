import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";
import { obtenerClientes } from "@/app/dashboard/clientes/actions";
import { buscarProductosPresupuesto } from "../actions";
import { NuevoPresupuestoClient } from "@/components/presupuestos/nuevo-presupuesto-client";

export default async function NuevoPresupuestoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [tasaActivaData, productosIniciales, clientesIniciales] = await Promise.all([
    obtenerTasaActiva(),
    buscarProductosPresupuesto(""),
    obtenerClientes(""),
  ]);

  const tasaActiva = tasaActivaData?.tasa ?? 1;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <NuevoPresupuestoClient
        productosIniciales={productosIniciales}
        clientesIniciales={clientesIniciales}
        tasaActiva={tasaActiva}
      />
    </div>
  );
}
