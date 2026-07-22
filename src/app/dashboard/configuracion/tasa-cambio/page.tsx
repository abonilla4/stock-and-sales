import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { TasaCambioClient } from "./tasa-cambio-client";
import { obtenerTasaActiva, obtenerHistorialTasas } from "./actions";

export default async function TasaCambioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const perfil = await getPerfil();
  const isAdmin = perfil?.role === "admin";

  const [tasaActiva, historial] = await Promise.all([
    obtenerTasaActiva(),
    obtenerHistorialTasas(),
  ]);

  return (
    <TasaCambioClient
      tasaActiva={tasaActiva}
      historial={historial}
      isAdmin={isAdmin}
    />
  );
}
