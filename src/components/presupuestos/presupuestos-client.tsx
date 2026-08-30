"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  FileCheck2,
  Eye,
  ShoppingCart,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PresupuestoConEstadoExtendido, DetallePresupuestoCompleto } from "@/app/dashboard/presupuestos/actions";
import {
  obtenerPresupuestos,
  obtenerDetallePresupuesto,
} from "@/app/dashboard/presupuestos/actions";
import { PresupuestoDetalleDialog } from "./presupuesto-detalle-dialog";
import { ConvertirPresupuestoDialog } from "./convertir-presupuesto-dialog";
import { PosReceiptDialog, type ReciboVentaData } from "@/components/pos/pos-receipt-dialog";
import { toast } from "sonner";

interface PresupuestosClientProps {
  presupuestosIniciales: PresupuestoConEstadoExtendido[];
  tasaActiva: number;
  isAdmin: boolean;
}

export function PresupuestosClient({
  presupuestosIniciales,
  tasaActiva,
  isAdmin,
}: PresupuestosClientProps) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoConEstadoExtendido[]>(presupuestosIniciales);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Estados de modales
  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState<DetallePresupuestoCompleto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [convertirModalOpen, setConvertirModalOpen] = useState(false);
  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [reciboVenta, setReciboVenta] = useState<ReciboVentaData | null>(null);

  // Recalcular métricas
  const totalVigentes = presupuestos.filter((p) => p.estado === "vigente" && !p.es_vencido).length;
  const totalVencidos = presupuestos.filter((p) => p.es_vencido).length;
  const totalConvertidos = presupuestos.filter((p) => p.estado === "convertido").length;

  const refrescarLista = async (nuevoFiltro?: string, nuevoTexto?: string) => {
    const estado = (nuevoFiltro !== undefined ? nuevoFiltro : filtroEstado) as any;
    const text = nuevoTexto !== undefined ? nuevoTexto : busqueda;

    startTransition(async () => {
      const data = await obtenerPresupuestos({
        estado: estado,
        busqueda: text,
      });
      setPresupuestos(data);
    });
  };

  const handleCambiarFiltro = (tab: string) => {
    setFiltroEstado(tab);
    refrescarLista(tab, busqueda);
  };

  const handleBuscar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusqueda(val);
    refrescarLista(filtroEstado, val);
  };

  const handleVerDetalle = async (id: string) => {
    setCargandoDetalle(true);
    try {
      const detalle = await obtenerDetallePresupuesto(id);
      if (detalle) {
        setPresupuestoSeleccionado(detalle);
        setDetalleModalOpen(true);
      } else {
        toast.error("No se pudo cargar el detalle del presupuesto.");
      }
    } catch (err: any) {
      toast.error("Error al cargar detalle: " + err.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleAbrirConversion = async (p: PresupuestoConEstadoExtendido | DetallePresupuestoCompleto) => {
    if ("detalles" in p) {
      setPresupuestoSeleccionado(p);
      setConvertirModalOpen(true);
    } else {
      setCargandoDetalle(true);
      try {
        const detalle = await obtenerDetallePresupuesto(p.id);
        if (detalle) {
          setPresupuestoSeleccionado(detalle);
          setConvertirModalOpen(true);
        }
      } catch (err: any) {
        toast.error("Error al preparar conversión: " + err.message);
      } finally {
        setCargandoDetalle(false);
      }
    }
  };

  const handleConversionExitosa = (recibo: ReciboVentaData) => {
    setReciboVenta(recibo);
    setReciboModalOpen(true);
    refrescarLista();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y botón de crear */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Presupuestos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cotizaciones informativas y comerciales con conversión directa a facturación.
          </p>
        </div>
        <Link
          href="/dashboard/presupuestos/nuevo"
          className={buttonVariants({ className: "shrink-0 gap-2" })}
        >
          <Plus className="size-4" /> Nuevo Presupuesto
        </Link>
      </div>

      {/* Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Vigentes
              </p>
              <p className="text-2xl font-bold text-foreground">{totalVigentes}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Vigencia Vencida
              </p>
              <p className="text-2xl font-bold text-foreground">{totalVencidos}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Facturados
              </p>
              <p className="text-2xl font-bold text-foreground">{totalConvertidos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles de Filtros y Búsqueda */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filtroEstado} onValueChange={handleCambiarFiltro} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="vigente">Vigentes</TabsTrigger>
            <TabsTrigger value="vencido">Vencidos</TabsTrigger>
            <TabsTrigger value="convertido">Facturados</TabsTrigger>
            <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio o nota..."
            value={busqueda}
            onChange={handleBuscar}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Tabla de Presupuestos */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {presupuestos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="mx-auto size-12 opacity-30 mb-3" />
            <p className="font-semibold text-base">No hay presupuestos registrados</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Crea tu primer presupuesto para presentar cotizaciones a tus clientes sin comprometer inventario.
            </p>
            <Link
              href="/dashboard/presupuestos/nuevo"
              className={buttonVariants({ size: "sm", className: "mt-4 gap-2" })}
            >
              <Plus className="size-4" /> Crear Presupuesto
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 text-[11px] font-bold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4">Vigencia</th>
                  <th className="py-3 px-4 text-right">Total USD</th>
                  <th className="py-3 px-4 text-right">Ref. Bs</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {presupuestos.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {p.folio}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-foreground">
                        {p.cliente?.nombre ?? "Cliente genérico"}
                      </p>
                      {p.cliente?.identificacion && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {p.cliente.identificacion}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(p.fecha_creacion).toLocaleDateString("es-VE", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        {new Date(p.fecha_vigencia).toLocaleDateString("es-VE", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ${p.total_usd.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground text-[11px]">
                      Bs. {((p.total_bs_referencia ?? (p.total_usd * (p.tasa_cambio_referencia || 1)))).toLocaleString("es-VE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.estado === "convertido" ? (
                        <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 hover:bg-blue-600/20 border-blue-500/30 text-[10px]">
                          Facturado
                        </Badge>
                      ) : p.estado === "cancelado" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Cancelado
                        </Badge>
                      ) : p.es_vencido ? (
                        <Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-400 hover:bg-amber-600/20 border-amber-500/30 text-[10px]">
                          Vencido
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 border-emerald-500/30 text-[10px]">
                          Vigente
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleVerDetalle(p.id)}
                          disabled={cargandoDetalle}
                        >
                          <Eye className="size-3.5 mr-1" /> Ver
                        </Button>

                        {p.estado === "vigente" && (
                          <Button
                            size="xs"
                            className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleAbrirConversion(p)}
                            disabled={cargandoDetalle}
                          >
                            <ShoppingCart className="size-3.5 mr-1" /> Facturar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle / Imprimir */}
      <PresupuestoDetalleDialog
        open={detalleModalOpen}
        onOpenChange={setDetalleModalOpen}
        presupuesto={presupuestoSeleccionado}
        onConvertir={(p) => {
          setPresupuestoSeleccionado(p);
          setConvertirModalOpen(true);
        }}
        onPresupuestoCancelado={() => refrescarLista()}
      />

      {/* Modal de Conversión a Factura */}
      <ConvertirPresupuestoDialog
        open={convertirModalOpen}
        onOpenChange={setConvertirModalOpen}
        presupuesto={presupuestoSeleccionado}
        tasaActiva={tasaActiva}
        isAdmin={isAdmin}
        onConversionExitosa={handleConversionExitosa}
      />

      {/* Modal de Recibo POS generado tras la venta */}
      <PosReceiptDialog
        open={reciboModalOpen}
        onOpenChange={setReciboModalOpen}
        recibo={reciboVenta}
        onNuevaVenta={() => {
          setReciboModalOpen(false);
          refrescarLista();
        }}
      />
    </div>
  );
}
