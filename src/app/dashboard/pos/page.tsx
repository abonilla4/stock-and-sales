import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";
import { buscarProductosPOS, obtenerClientesPOS } from "./actions";
import { PosCartProvider } from "@/components/pos/pos-cart-context";
import { PosSearch } from "@/components/pos/pos-search";
import { PosCart } from "@/components/pos/pos-cart";
import { TasaAlertaBanner } from "@/components/tasa-alerta-banner";

export default async function PosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const perfil = await getPerfil();
  const isAdmin = perfil?.role === "admin";

  const [tasaActivaData, productosIniciales, clientes] = await Promise.all([
    obtenerTasaActiva(),
    buscarProductosPOS(""),
    obtenerClientesPOS(),
  ]);

  const tasaActiva = tasaActivaData?.tasa ?? 0;
  const fechaTasa = tasaActivaData?.fecha ?? null;

  const horasTranscurridas = fechaTasa
    ? (new Date().getTime() - new Date(fechaTasa).getTime()) / (1000 * 60 * 60)
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] space-y-4">
      {/* Alerta de tasa de cambio si es mayor a 24h o no existe */}
      <TasaAlertaBanner
        tasaActiva={tasaActiva}
        fechaTasa={fechaTasa}
        horasTranscurridas={horasTranscurridas}
        sinTasa={!tasaActivaData}
      />

      {/* Proveedor del estado del carrito en memoria */}
      <PosCartProvider tasaInicial={tasaActiva}>
        <div className="grid flex-1 gap-6 overflow-hidden md:grid-cols-12">
          {/* Columna izquierda: Buscador y cuadrícula de productos (7 cols) */}
          <div className="flex flex-col h-full overflow-hidden md:col-span-7">
            <PosSearch productosIniciales={productosIniciales} />
          </div>

          {/* Columna derecha: Carrito de ventas y cobro (5 cols) */}
          <div className="flex flex-col h-full overflow-hidden md:col-span-5">
            <PosCart clientes={clientes} isAdmin={isAdmin} />
          </div>
        </div>
      </PosCartProvider>
    </div>
  );
}
