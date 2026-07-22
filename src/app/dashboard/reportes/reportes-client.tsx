"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  CreditCard,
  Printer,
  Loader2,
  Calendar,
  Layers,
  Phone,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { TarjetaKpiDual } from "@/components/reportes/tarjeta-kpi-dual";
import { FiltrosFechaReporte } from "@/components/reportes/filtros-fecha-reporte";
import {
  obtenerReporteVentasPeriodo,
  obtenerReporteTopProductos,
  obtenerReporteMargenGanancia,
  obtenerReporteInventarioValorizado,
  obtenerReporteCuentasPorCobrar,
  type ReporteVentasPeriodo,
  type TopProductoItem,
  type ReporteMargenGanancia,
  type ReporteInventarioValorizado,
  type ReporteCuentasPorCobrar,
} from "./actions";

interface ReportesClientProps {
  tasaActiva: number;
}

export function ReportesClient({ tasaActiva }: ReportesClientProps) {
  // Configurar rango inicial de fechas (últimos 30 días)
  const hoy = new Date();
  const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [fechaInicio, setFechaInicio] = useState(hace30Dias.toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState(hoy.toISOString().split("T")[0]);
  const [cargando, setCargando] = useState(false);

  // Estados para cada uno de los 5 reportes
  const [reporteVentas, setReporteVentas] = useState<ReporteVentasPeriodo | null>(null);
  const [reporteTop, setReporteTop] = useState<TopProductoItem[]>([]);
  const [reporteMargen, setReporteMargen] = useState<ReporteMargenGanancia | null>(null);
  const [reporteInventario, setReporteInventario] = useState<ReporteInventarioValorizado | null>(null);
  const [reporteCuentas, setReporteCuentas] = useState<ReporteCuentasPorCobrar | null>(null);

  const cargarReportes = useCallback(async () => {
    setCargando(true);
    try {
      const [ventas, top, margen, inventario, cuentas] = await Promise.all([
        obtenerReporteVentasPeriodo(fechaInicio, fechaFin),
        obtenerReporteTopProductos(fechaInicio, fechaFin, 10),
        obtenerReporteMargenGanancia(fechaInicio, fechaFin),
        obtenerReporteInventarioValorizado(),
        obtenerReporteCuentasPorCobrar(fechaInicio, fechaFin),
      ]);

      setReporteVentas(ventas);
      setReporteTop(top);
      setReporteMargen(margen);
      setReporteInventario(inventario);
      setReporteCuentas(cuentas);
    } catch (err) {
      console.error("Error al cargar datos de reportes:", err);
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    cargarReportes();
  }, [cargarReportes]);

  const handleCambiarRango = (inicio: string, fin: string) => {
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Métricas Analíticas</h1>
          <p className="text-sm text-muted-foreground">
            Visualización dual en USD y Bs de ventas, productos top, utilidades, inventario valorizado y crédito.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleImprimir} className="shrink-0">
          <Printer className="mr-2 size-4" /> Imprimir / Exportar
        </Button>
      </div>

      {/* Filtro de Rango de Fechas */}
      <FiltrosFechaReporte
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onCambiarRango={handleCambiarRango}
      />

      {cargando ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Calculando reportes y agregaciones...</span>
        </div>
      ) : (
        /* Tabs para los 5 Reportes Must-Have */
        <Tabs defaultValue="ventas" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 gap-1">
            <TabsTrigger value="ventas" className="text-xs py-2">
              <BarChart3 className="mr-1.5 size-3.5" /> Ventas por Período
            </TabsTrigger>
            <TabsTrigger value="top" className="text-xs py-2">
              <TrendingUp className="mr-1.5 size-3.5" /> Más Vendidos
            </TabsTrigger>
            <TabsTrigger value="margen" className="text-xs py-2">
              <DollarSign className="mr-1.5 size-3.5" /> Margen y Ganancia
            </TabsTrigger>
            <TabsTrigger value="inventario" className="text-xs py-2">
              <Package className="mr-1.5 size-3.5" /> Inventario Valorizado
            </TabsTrigger>
            <TabsTrigger value="cuentas" className="text-xs py-2">
              <CreditCard className="mr-1.5 size-3.5" /> Cuentas por Cobrar
            </TabsTrigger>
          </TabsList>

          {/* REPORTE 1: Ventas por Período */}
          <TabsContent value="ventas" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <TarjetaKpiDual
                label="Facturado en Período"
                montoUsd={reporteVentas?.totalIngresosUsd ?? 0}
                montoBs={reporteVentas?.totalIngresosBs ?? 0}
                variant="emerald"
                icon={<BarChart3 className="size-4 text-emerald-600" />}
                subtext={`${reporteVentas?.totalVentasCount ?? 0} ventas completadas`}
              />
              <TarjetaKpiDual
                label="Ticket Promedio"
                montoUsd={reporteVentas?.ticketPromedioUsd ?? 0}
                montoBs={reporteVentas?.ticketPromedioBs ?? 0}
                variant="blue"
                icon={<DollarSign className="size-4 text-blue-600" />}
                subtext="Monto promedio por transacción"
              />
              <Card>
                <CardHeader className="pb-2">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Transacciones Totales
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-extrabold">{reporteVentas?.totalVentasCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ventas procesadas en el rango
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de Desglose por Día */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Desglose de Ventas por Día</CardTitle>
                <CardDescription>
                  Resumen de operaciones procesadas por fecha en el rango seleccionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reporteVentas?.ventasPorFecha && reporteVentas.ventasPorFecha.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-center">Cant. Ventas</TableHead>
                          <TableHead className="text-right">Total Facturado (USD)</TableHead>
                          <TableHead className="text-right">Total Facturado (Bs)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reporteVentas.ventasPorFecha.map((item) => (
                          <TableRow key={item.fecha}>
                            <TableCell className="font-mono text-xs font-medium">
                              {new Date(item.fecha + "T00:00:00").toLocaleDateString("es-VE", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-center font-mono">{item.ventasCount}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${item.totalUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              Bs. {item.totalBs.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay ventas registradas en el período seleccionado.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTE 2: Productos más Vendidos */}
          <TabsContent value="top" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Ranking de Productos Más Vendidos (Top 10)</CardTitle>
                <CardDescription>
                  Productos con mayor volumen de salida e ingresos generados en el período.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reporteTop.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad Vendida</TableHead>
                          <TableHead className="text-right">Ingresos (USD)</TableHead>
                          <TableHead className="text-right">Ingresos (Bs)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reporteTop.map((p, idx) => (
                          <TableRow key={p.productoId}>
                            <TableCell className="text-center font-bold text-muted-foreground text-xs">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                            <TableCell className="font-medium">{p.nombre}</TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {p.cantidadVendida} <span className="text-xs font-normal text-muted-foreground">{p.unidadMedida}s</span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${p.totalIngresosUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              Bs. {p.totalIngresosBs.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No se han registrado ventas de productos en el período.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTE 3: Margen y Ganancia */}
          <TabsContent value="margen" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <TarjetaKpiDual
                label="Ingresos Totales"
                montoUsd={reporteMargen?.ingresosTotalesUsd ?? 0}
                montoBs={reporteMargen?.ingresosTotalesBs ?? 0}
                variant="blue"
              />
              <TarjetaKpiDual
                label="Costo de Ventas"
                montoUsd={reporteMargen?.costoVentasUsd ?? 0}
                montoBs={reporteMargen?.costoVentasBs ?? 0}
                variant="destructive"
              />
              <TarjetaKpiDual
                label="Ganancia Bruta Utilidad"
                montoUsd={reporteMargen?.gananciaBrutaUsd ?? 0}
                montoBs={reporteMargen?.gananciaBrutaBs ?? 0}
                variant="emerald"
                subtext={`Margen Bruto de Utilidad: ${reporteMargen?.porcentajeMargen ?? 0}%`}
              />
            </div>

            {/* Análisis de Margen */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Análisis Financiero de Rentabilidad</CardTitle>
                <CardDescription>
                  Cálculo de Utilidad Bruta = Ingresos Totales por Ventas - Costo de Adquisición de Productos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Ventas Totales Realizadas (USD):</span>
                    <span className="font-mono font-bold">${(reporteMargen?.ingresosTotalesUsd ?? 0).toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Costo Reemplazo de Mercancía (USD):</span>
                    <span className="font-mono font-semibold text-destructive">-${(reporteMargen?.costoVentasUsd ?? 0).toFixed(2)} USD</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center text-base font-bold">
                    <span>Ganancia Neta Estimada (USD):</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xl">
                      ${(reporteMargen?.gananciaBrutaUsd ?? 0).toFixed(2)} USD
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                    <span>Equivalente en Bolívares:</span>
                    <span className="font-mono">Bs. {(reporteMargen?.gananciaBrutaBs ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTE 4: Inventario Valorizado */}
          <TabsContent value="inventario" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <TarjetaKpiDual
                label="Valor Inventario a Costo"
                montoUsd={reporteInventario?.valorTotalCostoUsd ?? 0}
                montoBs={reporteInventario?.valorTotalCostoBs ?? 0}
                variant="blue"
                subtext="Costo total de adquisición del stock"
              />
              <TarjetaKpiDual
                label="Valor Inventario a Venta"
                montoUsd={reporteInventario?.valorTotalVentaUsd ?? 0}
                montoBs={reporteInventario?.valorTotalVentaBs ?? 0}
                variant="emerald"
                subtext="Valor total estimado al público"
              />
              <TarjetaKpiDual
                label="Ganancia Potencial Stock"
                montoUsd={reporteInventario?.gananciaEstimadaGlobalUsd ?? 0}
                montoBs={reporteInventario?.gananciaEstimadaGlobalBs ?? 0}
                variant="amber"
                subtext="Utilidad estimada si se vende todo el stock"
              />
            </div>

            {/* Desglose por Categorías */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Valorización del Inventario por Categoría</CardTitle>
                <CardDescription>
                  Distribución del capital invertido en productos activos según su clasificación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reporteInventario?.porCategoria && reporteInventario.porCategoria.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-center">Productos</TableHead>
                          <TableHead className="text-right">Stock Acumulado</TableHead>
                          <TableHead className="text-right">Valor a Costo (USD)</TableHead>
                          <TableHead className="text-right">Valor a Venta (USD)</TableHead>
                          <TableHead className="text-right">Ganancia Est. (USD)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reporteInventario.porCategoria.map((cat) => (
                          <TableRow key={cat.categoriaId}>
                            <TableCell className="font-semibold">{cat.categoriaNombre}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{cat.totalProductos}</TableCell>
                            <TableCell className="text-right font-mono">{cat.stockTotal}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              ${cat.valorCostoUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-foreground">
                              ${cat.valorVentaUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              +${cat.gananciaEstimadaUsd.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay categorías con stock activo registradas.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTE 5: Cuentas por Cobrar */}
          <TabsContent value="cuentas" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <TarjetaKpiDual
                label="Saldo Total por Cobrar"
                montoUsd={reporteCuentas?.saldoTotalPorCobrarUsd ?? 0}
                montoBs={reporteCuentas?.saldoTotalPorCobrarBs ?? 0}
                variant="amber"
                icon={<CreditCard className="size-4 text-amber-600" />}
                subtext={`${reporteCuentas?.totalClientesConDeuda ?? 0} clientes con saldo pendiente`}
              />
              <TarjetaKpiDual
                label="Abonos Recibidos en Período"
                montoUsd={reporteCuentas?.abonosRecibidosEnPeriodoUsd ?? 0}
                montoBs={reporteCuentas?.abonosRecibidosEnPeriodoBs ?? 0}
                variant="emerald"
                icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                subtext="Total cobrado en el rango de fecha"
              />
              <Card>
                <CardHeader className="pb-2">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Clientes Deudores
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-extrabold text-amber-700 dark:text-amber-400">
                    {reporteCuentas?.totalClientesConDeuda ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cuentas activas pendientes de pago
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de Clientes con Deuda */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Lista de Clientes con Cuentas Pendientes</CardTitle>
                <CardDescription>
                  Detalle individual de saldos a crédito acumulados por cobro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reporteCuentas?.clientesDeudores && reporteCuentas.clientesDeudores.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Cédula / RIF</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead className="text-right">Saldo Pendiente (USD)</TableHead>
                          <TableHead className="text-right">Saldo Pendiente (Bs)</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reporteCuentas.clientesDeudores.map((c) => (
                          <TableRow key={c.clienteId} className="bg-amber-50/30 dark:bg-amber-950/10">
                            <TableCell className="font-semibold">{c.nombre}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {c.identificacion ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {c.telefono ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="size-3 text-muted-foreground" /> {c.telefono}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                              ${c.saldoUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              Bs. {c.saldoBs.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs">
                                <AlertCircle className="mr-1 size-3" /> Pendiente
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    ¡Excelente! No hay ningún cliente con cuentas pendientes de pago.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
