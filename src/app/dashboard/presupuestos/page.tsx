import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";
import { obtenerPresupuestos } from "./actions";
import { PresupuestosClient } from "@/components/presupuestos/presupuestos-client";

export default async function PresupuestosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const perfil = await getPerfil();
  const isAdmin = perfil?.role === "admin";

  const [tasaActivaData, presupuestosIniciales] = await Promise.all([
    obtenerTasaActiva(),
    obtenerPresupuestos({ estado: "todos" }),
  ]);

  const tasaActiva = tasaActivaData?.tasa ?? 1;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <PresupuestosClient
        presupuestosIniciales={presupuestosIniciales}
        tasaActiva={tasaActiva}
        isAdmin={isAdmin}
      />
    </div>
  );
}
