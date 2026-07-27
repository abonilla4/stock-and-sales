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
import {
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Receipt,
  PieChart,
} from "lucide-react";
import { obtenerTasaActiva } from "@/app/dashboard/configuracion/tasa-cambio/actions";
import { TasaAlertaBanner } from "@/components/tasa-alerta-banner";
import { getRangosDiaVenezuela } from "@/lib/utils/dates-vzla";
import { formatUSD, formatBs, formatNumero } from "@/lib/formatters";

const METODO_PAGO_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  efectivo_usd: { label: "Efectivo USD ($)", icon: DollarSign },
  efectivo_bs: { label: "Efectivo Bs.", icon: Banknote },
  pago_movil: { label: "Pago Móvil", icon: Smartphone },
  transferencia: { label: "Transferencia", icon: Building2 },
  tarjeta: { label: "Tarjeta (Punto)", icon: CreditCard },
  fiado: { label: "Crédito (Fiado)", icon: Receipt },
};

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

  // Rangos de tiempo en hora de Venezuela (America/Caracas, UTC-4)
  const hoyRango = getRangosDiaVenezuela(0);
  const ayerRango = getRangosDiaVenezuela(-1);

  // Consultas paralelas a Supabase
  const [
    { count: totalProductos },
    { count: totalCategorias },
    { data: ventasHoy },
    { data: ventasAyer },
    { data: clientesDeuda },
    { data: productosStockBajo },
    tasaActivaData,
  ] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("categorias").select("id", { count: "exact", head: true }),
    supabase
      .from("ventas")
      .select("id, total_usd, total_bs, metodo_pago")
      .eq("estado", "completada")
      .gte("fecha", hoyRango.inicioUtc)
      .lte("fecha", hoyRango.finUtc),
    supabase
      .from("ventas")
      .select("total_usd")
      .eq("estado", "completada")
      .gte("fecha", ayerRango.inicioUtc)
      .lte("fecha", ayerRango.finUtc),
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

  const tasaActiva = tasaActivaData?.tasa ?? 1;
  const fechaTasa = tasaActivaData?.fecha ?? null;
  const horasTranscurridas = fechaTasa
    ? (new Date().getTime() - new Date(fechaTasa).getTime()) / (1000 * 60 * 60)
    : null;

  // 1. Totales de Ventas de Hoy
  const ventasHoyUsd = Number(
    (ventasHoy ?? []).reduce((acc, v) => acc + (v.total_usd || 0), 0).toFixed(2)
  );
  const ventasHoyBs = Number(
    (ventasHoy ?? []).reduce((acc, v) => acc + (v.total_bs || 0), 0).toFixed(2)
  );

  // 2. Comparación contra el día anterior
  const totalVentasAyerUsd = Number(
    (ventasAyer ?? []).reduce((acc, v) => acc + (v.total_usd || 0), 0).toFixed(2)
  );
  const porcentajeCambioAyer =
    totalVentasAyerUsd > 0
      ? ((ventasHoyUsd - totalVentasAyerUsd) / totalVentasAyerUsd) * 100
      : ventasHoyUsd > 0
      ? 100
      : 0;

  // 3. Desglose de Métodos de Pago del Día
  const desgloseMetodos: Record<string, { totalUsd: number; totalBs: number; cantidad: number }> = {
    efectivo_usd: { totalUsd: 0, totalBs: 0, cantidad: 0 },
    efectivo_bs: { totalUsd: 0, totalBs: 0, cantidad: 0 },
    pago_movil: { totalUsd: 0, totalBs: 0, cantidad: 0 },
    transferencia: { totalUsd: 0, totalBs: 0, cantidad: 0 },
    tarjeta: { totalUsd: 0, totalBs: 0, cantidad: 0 },
    fiado: { totalUsd: 0, totalBs: 0, cantidad: 0 },
  };

  (ventasHoy ?? []).forEach((v) => {
    if (desgloseMetodos[v.metodo_pago]) {
      desgloseMetodos[v.metodo_pago].totalUsd += Number(v.total_usd || 0);
      desgloseMetodos[v.metodo_pago].totalBs += Number(v.total_bs || 0);
      desgloseMetodos[v.metodo_pago].cantidad += 1;
    }
  });

  // 4. Margen Bruto del Día (usando costo_unitario_usd congelado en detalle_venta)
  const ventaIdsHoy = (ventasHoy ?? []).map((v) => v.id);
  let costoTotalVentasHoyUsd = 0;

  if (ventaIdsHoy.length > 0) {
    const { data: detallesHoy } = await supabase
      .from("detalle_venta")
      .select("cantidad, costo_unitario_usd, subtotal_usd")
      .in("venta_id", ventaIdsHoy);

    (detallesHoy ?? []).forEach((d) => {
      costoTotalVentasHoyUsd += Number(d.cantidad) * Number(d.costo_unitario_usd || 0);
    });
  }

  const gananciaBrutaHoyUsd = Number((ventasHoyUsd - costoTotalVentasHoyUsd).toFixed(2));
  const porcentajeMargenHoy =
    ventasHoyUsd > 0 ? Number(((gananciaBrutaHoyUsd / ventasHoyUsd) * 100).toFixed(2)) : 0;

  // Cuentas por cobrar acumuladas
  const porCobrarUsd = Number(
    (clientesDeuda ?? []).reduce((acc, c) => acc + (c.saldo_fiado || 0), 0).toFixed(2)
  );
  const porCobrarBs = Number((porCobrarUsd * tasaActiva).toFixed(2));

  // Stock Bajo
  const stockBajo =
    productosStockBajo?.filter((p) => p.stock_actual <= p.stock_minimo) ?? [];
  const hayAlertas = stockBajo.length > 0;

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
          Resumen operativo y métricas en tiempo real (Hora Venezuela UTC-4).
        </p>
      </div>

      {/* Primary KPI Grid (5 Tarjetas) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Ventas de Hoy (con indicador comparativo vs ayer) */}
        <Card className="border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Ventas de Hoy
            </p>
            <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {formatUSD(ventasHoyUsd)} <span className="text-xs font-semibold text-muted-foreground">USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {formatBs(ventasHoyBs)} ({ventasHoy?.length ?? 0} ventas)
            </p>
            {/* Indicador ▲/▼ vs Ayer */}
            <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
              {porcentajeCambioAyer >= 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="size-3.5" />
                  +{porcentajeCambioAyer.toFixed(1)}% vs ayer
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="size-3.5" />
                  {porcentajeCambioAyer.toFixed(1)}% vs ayer
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Margen Bruto de Hoy */}
        <Card className={gananciaBrutaHoyUsd >= 0 ? "border-sky-300 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20" : "border-rose-300 bg-rose-50/40 dark:border-rose-800 dark:bg-rose-950/20"}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Margen Bruto Hoy
            </p>
            <PieChart className="size-4 text-sky-600 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <p className={`font-mono text-2xl font-extrabold ${gananciaBrutaHoyUsd >= 0 ? "text-sky-700 dark:text-sky-400" : "text-rose-700 dark:text-rose-400"}`}>
              {formatUSD(gananciaBrutaHoyUsd)} <span className="text-xs font-semibold text-muted-foreground">USD</span>
            </p>
            <p className="mt-1 text-xs font-semibold font-mono">
              Margen: <span className={porcentajeMargenHoy >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{porcentajeMargenHoy.toFixed(1)}%</span>
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Costo congelado: {formatUSD(costoTotalVentasHoyUsd)}
            </p>
          </CardContent>
        </Card>

        {/* 3. Cuentas por cobrar */}
        <Card className={porCobrarUsd > 0 ? "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Por Cobrar (Crédito)
            </p>
            <DollarSign className="size-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-extrabold text-amber-700 dark:text-amber-400">
              {formatUSD(porCobrarUsd)} <span className="text-xs font-semibold text-muted-foreground">USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {formatBs(porCobrarBs)}
            </p>
          </CardContent>
        </Card>

        {/* 4. Tasa activa */}
        <Card className={horasTranscurridas && horasTranscurridas >= 24 ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Tasa Activa
            </p>
            <DollarSign className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {tasaActivaData ? formatBs(tasaActivaData.tasa) : "—"} <span className="text-xs font-normal text-muted-foreground">/USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tasaActivaData ? `Refrescada ${new Date(tasaActivaData.fecha).toLocaleDateString("es-VE")}` : "Sin tasa registrada"}
            </p>
          </CardContent>
        </Card>

        {/* 5. Stock Bajo */}
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

      {/* Desglose de Métodos de Pago del Día */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Desglose por Métodos de Pago de Hoy</span>
            <span className="text-xs font-normal text-muted-foreground font-mono">
              Total VZLA: {formatUSD(ventasHoyUsd)} / {formatBs(ventasHoyBs)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(desgloseMetodos).map(([key, data]) => {
              const info = METODO_PAGO_LABELS[key] || { label: key, icon: DollarSign };
              const IconComp = info.icon;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border p-3 bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-muted p-2 text-foreground">
                      <IconComp className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{info.label}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {data.cantidad} {data.cantidad === 1 ? "venta" : "ventas"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-sm font-semibold text-foreground">
                      {formatUSD(data.totalUsd)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBs(data.totalBs)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Panel de alertas de stock bajo */}
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
                        {formatNumero(p.stock_actual)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {p.unidad_medida}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatNumero(p.stock_minimo)}
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
