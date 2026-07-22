import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteDetalleClient } from "./cliente-detalle-client";
import { obtenerDetalleCliente } from "../actions";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetallePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [detalle, tasaActivaData] = await Promise.all([
    obtenerDetalleCliente(id),
    obtenerTasaActiva(),
  ]);

  if (!detalle) {
    notFound();
  }

  const tasaActiva = tasaActivaData?.tasa ?? 0;

  return (
    <ClienteDetalleClient
      cliente={detalle.cliente}
      ventas={detalle.ventas}
      abonos={detalle.abonos}
      tasaActiva={tasaActiva}
    />
  );
}
