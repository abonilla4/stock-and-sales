import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, DollarSign } from "lucide-react";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";
import { TasaAlertaBanner } from "@/components/tasa-alerta-banner";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (error) {
    console.error("Error de Supabase en Dashboard:", error);
  }

  if (!user) {
    redirect("/login");
  }

  // Fechas para ventas de hoy
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date();
  hoyFin.setHours(23, 59, 59, 999);

  // Fetch summary counts, ventas de hoy, cuentas por cobrar y tasa activa
  const [
    { count: totalProductos },
    { count: totalCategorias },
    { data: ventasHoy },
    { data: clientesDeuda },
    { data: productosStockBajo },
    tasaActivaData,
  ] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("categorias").select("id", { count: "exact", head: true }),
    supabase
      .from("ventas")
      .select("total_usd, total_bs")
      .eq("estado", "completada")
      .gte("fecha", hoyInicio.toISOString())
      .lte("fecha", hoyFin.toISOString()),
    supabase
      .from("clientes")
      .select("saldo_fiado")
      .gt("saldo_fiado", 0),
    supabase
      .from("productos")
      .select("id, sku, nombre, stock_actual, stock_minimo, unidad_medida")
      .eq("activo", true)
      .order("stock_actual", { ascending: true })
      .limit(50),
    obtenerTasaActiva(),
  ]);

  // Filter stock bajo client-side
  const stockBajo =
    productosStockBajo?.filter((p) => p.stock_actual <= p.stock_minimo) ?? [];
  const hayAlertas = stockBajo.length > 0;

  const tasaActiva = tasaActivaData?.tasa ?? 1;
  const fechaTasa = tasaActivaData?.fecha ?? null;
  const horasTranscurridas = fechaTasa
    ? (new Date().getTime() - new Date(fechaTasa).getTime()) / (1000 * 60 * 60)
    : null;

  // Totales de Hoy
  const ventasHoyUsd = Number(
    (ventasHoy ?? []).reduce((acc, v) => acc + (v.total_usd || 0), 0).toFixed(2)
  );
  const ventasHoyBs = Number(
    (ventasHoy ?? []).reduce((acc, v) => acc + (v.total_bs || 0), 0).toFixed(2)
  );

  // Cuentas por cobrar acumuladas
  const porCobrarUsd = Number(
    (clientesDeuda ?? []).reduce((acc, c) => acc + (c.saldo_fiado || 0), 0).toFixed(2)
  );
  const porCobrarBs = Number((porCobrarUsd * tasaActiva).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Banner de alerta si la tasa tiene >24h sin actualizar */}
      <TasaAlertaBanner
        tasaActiva={tasaActivaData?.tasa ?? null}
        fechaTasa={fechaTasa}
        horasTranscurridas={horasTranscurridas}
        sinTasa={!tasaActivaData}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight font-sans">Dashboard General</h1>
        <p className="text-sm text-muted-foreground">
          Resumen operativo y métricas en tiempo real.
        </p>
      </div>

      {/* Summary cards — Doble moneda dual en ventas hoy y por cobrar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ventas de Hoy */}
        <Card className="border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Ventas de Hoy
            </p>
            <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              ${ventasHoyUsd.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Bs. {ventasHoyBs.toFixed(2)} ({ventasHoy?.length ?? 0} ventas)
            </p>
          </CardContent>
        </Card>

        {/* Cuentas por cobrar */}
        <Card className={porCobrarUsd > 0 ? "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Por Cobrar (Crédito)
            </p>
            <DollarSign className="size-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-extrabold text-amber-700 dark:text-amber-400">
              ${porCobrarUsd.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Bs. {porCobrarBs.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Tasa activa */}
        <Card className={horasTranscurridas && horasTranscurridas >= 24 ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Tasa Activa
            </p>
            <DollarSign className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {tasaActivaData ? `${tasaActivaData.tasa.toFixed(2)}` : "—"} <span className="text-xs font-normal text-muted-foreground">Bs/USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tasaActivaData ? `Refrescada ${new Date(tasaActivaData.fecha).toLocaleDateString("es-VE")}` : "Sin tasa registrada"}
            </p>
          </CardContent>
        </Card>

        {/* Stock Bajo */}
        {hayAlertas ? (
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-primary-foreground/70">
                Stock bajo
              </p>
              <AlertTriangle className="size-4 text-warning-strong" />
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold tabular-nums text-warning-strong">
                {stockBajo.length}
              </p>
              <p className="mt-1 text-xs text-primary-foreground/70">
                productos bajo el mínimo
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Stock bajo
              </p>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-semibold tabular-nums leading-10">0</p>
              <p className="mt-1 text-xs font-medium text-success">
                Todo sobre el mínimo
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Panel de alertas — siempre visible para que el espacio sea intencional */}
      {hayAlertas ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />
              Productos con stock bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock actual</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockBajo.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.sku}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/inventario/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-semibold tabular-nums text-warning">
                        {p.stock_actual}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {p.unidad_medida}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {p.stock_minimo}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">Todo en orden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ningún producto activo está por debajo de su stock mínimo.
          </p>
        </div>
      )}
    </div>
  );
}
