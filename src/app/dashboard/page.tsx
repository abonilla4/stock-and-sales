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

  // Fetch summary counts y tasa activa
  const [
    { count: totalProductos },
    { count: totalCategorias },
    { count: totalProveedores },
    { data: productosStockBajo },
    tasaActivaData,
  ] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("categorias").select("id", { count: "exact", head: true }),
    supabase.from("proveedores").select("id", { count: "exact", head: true }),
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

  const tasaActiva = tasaActivaData?.tasa ?? null;
  const fechaTasa = tasaActivaData?.fecha ?? null;
  const horasTranscurridas = fechaTasa
    ? (new Date().getTime() - new Date(fechaTasa).getTime()) / (1000 * 60 * 60)
    : null;

  return (
    <div className="space-y-6">
      {/* Banner de alerta si la tasa tiene >24h sin actualizar */}
      <TasaAlertaBanner
        tasaActiva={tasaActiva}
        fechaTasa={fechaTasa}
        horasTranscurridas={horasTranscurridas}
        sinTasa={!tasaActivaData}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general del inventario
        </p>
      </div>

      {/* Summary cards — Stock bajo es la tarjeta crítica; el resto es informativo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tasa activa */}
        <Card className={horasTranscurridas && horasTranscurridas >= 24 ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Tasa Activa
            </p>
            <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {tasaActiva ? `${tasaActiva.toFixed(2)}` : "—"} <span className="text-xs font-normal text-muted-foreground">Bs/USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tasaActivaData ? `Refrescada ${new Date(tasaActivaData.fecha).toLocaleDateString("es-VE")}` : "Sin tasa registrada"}
            </p>
          </CardContent>
        </Card>

        {hayAlertas ? (
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-primary-foreground/70">
                Stock bajo
              </p>
              <AlertTriangle className="size-4 text-warning-strong" />
            </CardHeader>
            <CardContent>
              <p className="font-mono text-4xl font-semibold tabular-nums text-warning-strong">
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

        <KpiCard label="Productos activos" value={totalProductos ?? 0} />
        <KpiCard label="Categorías" value={totalCategorias ?? 0} />
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
