"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Clock,
  Ban,
  CheckCircle2,
  DollarSign,
  Coins,
} from "lucide-react";
import { NEGOCIO_CONFIG } from "@/lib/config/negocio";
import type { DetallePresupuestoCompleto } from "@/app/dashboard/presupuestos/actions";
import { cancelarPresupuesto } from "@/app/dashboard/presupuestos/actions";
import { toast } from "sonner";

interface PresupuestoDetalleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuesto: DetallePresupuestoCompleto | null;
  onConvertir: (presupuesto: DetallePresupuestoCompleto) => void;
  onPresupuestoCancelado?: () => void;
}

export function PresupuestoDetalleDialog({
  open,
  onOpenChange,
  presupuesto,
  onConvertir,
  onPresupuestoCancelado,
}: PresupuestoDetalleDialogProps) {
  const [monedaVisualizacion, setMonedaVisualizacion] = useState<"usd" | "bs">(
    presupuesto?.moneda_mostrada ?? "usd"
  );
  const [cancelando, setCancelando] = useState(false);

  if (!presupuesto) return null;

  const tasa = presupuesto.tasa_cambio_referencia || 1;

  const handlePrint = () => {
    window.print();
  };

  const handleCancelar = async () => {
    if (!confirm(`¿Estás seguro de cancelar el presupuesto ${presupuesto.folio}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setCancelando(true);
    try {
      const res = await cancelarPresupuesto(presupuesto.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Presupuesto ${presupuesto.folio} cancelado exitosamente.`);
        onOpenChange(false);
        onPresupuestoCancelado?.();
      }
    } catch (err: any) {
      toast.error("Error al cancelar presupuesto: " + err.message);
    } finally {
      setCancelando(false);
    }
  };

  const formatearMonto = (montoUsd: number) => {
    if (monedaVisualizacion === "bs") {
      return `Bs. ${(montoUsd * tasa).toLocaleString("es-VE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `$${montoUsd.toFixed(2)}`;
  };

  const puedeConvertirse =
    presupuesto.estado === "vigente" || (presupuesto.estado as string) === "vigente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-bold font-mono">
                {presupuesto.folio}
              </DialogTitle>
              {presupuesto.estado === "convertido" ? (
                <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 hover:bg-blue-600/20 border-blue-500/30">
                  <CheckCircle2 className="mr-1 size-3" /> Facturado / Convertido
                </Badge>
              ) : presupuesto.estado === "cancelado" ? (
                <Badge variant="destructive">
                  <Ban className="mr-1 size-3" /> Cancelado
                </Badge>
              ) : presupuesto.es_vencido ? (
                <Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-400 hover:bg-amber-600/20 border-amber-500/30">
                  <Clock className="mr-1 size-3" /> Vigencia Vencida
                </Badge>
              ) : (
                <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 border-emerald-500/30">
                  <FileCheck2 className="mr-1 size-3" /> Vigente
                </Badge>
              )}
            </div>

            {/* Selector de moneda para visualización e impresión */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
              <Button
                type="button"
                variant={monedaVisualizacion === "usd" ? "default" : "ghost"}
                size="xs"
                className="h-7 text-xs px-2"
                onClick={() => setMonedaVisualizacion("usd")}
              >
                <DollarSign className="size-3 mr-1" /> USD
              </Button>
              <Button
                type="button"
                variant={monedaVisualizacion === "bs" ? "default" : "ghost"}
                size="xs"
                className="h-7 text-xs px-2"
                onClick={() => setMonedaVisualizacion("bs")}
              >
                <Coins className="size-3 mr-1" /> Bs.
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Advertencia si está vencido pero permite convertir */}
        {presupuesto.es_vencido && puedeConvertirse && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Presupuesto fuera de fecha de vigencia.</strong>
              <p className="mt-0.5">
                Aún es posible convertirlo a factura; el sistema revalidará automáticamente los precios de catálogo y la disponibilidad de stock en vivo al confirmar la venta.
              </p>
            </div>
          </div>
        )}

        {/* Documento Imprimible del Presupuesto */}
        <div
          id="presupuesto-print"
          className="space-y-4 rounded-xl border bg-card p-5 text-xs text-card-foreground font-sans shadow-sm"
        >
          {/* Encabezado Comercial */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b pb-4">
            <div className="space-y-1">
              {NEGOCIO_CONFIG.logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={NEGOCIO_CONFIG.logoUrl}
                  alt={NEGOCIO_CONFIG.nombre}
                  className="h-9 max-w-[150px] object-contain mb-1"
                />
              )}
              <h3 className="font-bold text-base uppercase tracking-tight text-foreground">
                {NEGOCIO_CONFIG.nombre}
              </h3>
              {NEGOCIO_CONFIG.rif && (
                <p className="text-muted-foreground font-mono text-[11px]">
                  RIF: {NEGOCIO_CONFIG.rif}
                </p>
              )}
              {NEGOCIO_CONFIG.direccion && (
                <p className="text-muted-foreground text-[11px]">
                  {NEGOCIO_CONFIG.direccion}
                </p>
              )}
              {NEGOCIO_CONFIG.telefono && (
                <p className="text-muted-foreground text-[11px]">
                  Tel: {NEGOCIO_CONFIG.telefono}
                </p>
              )}
            </div>

            <div className="space-y-1 text-right">
              <h4 className="font-bold text-lg text-primary font-mono">
                COTIZACIÓN
              </h4>
              <p className="font-mono text-sm font-semibold text-foreground">
                Nº: {presupuesto.folio}
              </p>
              <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1">
                <p className="flex items-center justify-end gap-1">
                  <Calendar className="size-3" /> Emisión:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(presupuesto.fecha_creacion).toLocaleDateString("es-VE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </p>
                <p className="flex items-center justify-end gap-1">
                  <Clock className="size-3" /> Válido hasta:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(presupuesto.fecha_vigencia).toLocaleDateString("es-VE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                Cliente
              </p>
              <p className="text-sm font-bold text-foreground">
                {presupuesto.cliente?.nombre ?? "Cliente genérico / Contado"}
              </p>
              {presupuesto.cliente?.identificacion && (
                <p className="text-xs text-muted-foreground font-mono">
                  C.I./RIF: {presupuesto.cliente.identificacion}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                Tasa Referencial de Emisión
              </p>
              <p className="text-sm font-bold text-foreground font-mono">
                Bs. {tasa.toFixed(2)} / USD
              </p>
              <p className="text-[10px] text-muted-foreground">
                Sujeto a la tasa vigente el día de la compra real
              </p>
            </div>
          </div>

          {/* Tabla de Artículos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-[11px] font-bold uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 px-2 text-center">Cant.</th>
                  <th className="py-2 px-2 text-right">
                    P. Unit ({monedaVisualizacion.toUpperCase()})
                  </th>
                  <th className="py-2 pl-2 text-right">
                    Subtotal ({monedaVisualizacion.toUpperCase()})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-[12px]">
                {presupuesto.detalles.map((det) => (
                  <tr key={det.id} className="hover:bg-muted/30">
                    <td className="py-2.5 pr-2">
                      <p className="font-semibold text-foreground">
                        {det.producto?.nombre ?? "Producto no disponible"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        SKU: {det.producto?.sku ?? "N/A"}
                      </p>
                    </td>
                    <td className="py-2.5 px-2 text-center font-medium font-mono">
                      {det.cantidad} {det.producto?.unidad_medida ?? "unid"}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {formatearMonto(det.precio_unitario_usd_referencia)}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-semibold font-mono text-foreground">
                      {formatearMonto(det.subtotal_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* Totales y Leyenda Legal */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7 space-y-2">
              {presupuesto.notas && (
                <div className="rounded bg-muted/40 p-2.5">
                  <p className="font-bold text-[11px] text-muted-foreground uppercase">
                    Observaciones:
                  </p>
                  <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">
                    {presupuesto.notas}
                  </p>
                </div>
              )}

              {/* Leyenda obligatoria de tasa referencial */}
              <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-[10px] text-muted-foreground">
                <p className="font-semibold text-primary">Nota importante:</p>
                <p className="mt-0.5">
                  Este presupuesto es de carácter informativo y <strong>no reserva inventario</strong>. Los montos expresados en Bolívares son referenciales (Tasa: Bs. {tasa.toFixed(2)}/USD) y se ajustarán a la tasa de cambio activa y disponibilidad real al momento de la facturación definitiva.
                </p>
              </div>
            </div>

            <div className="sm:col-span-5 space-y-1.5 font-mono text-right">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal:</span>
                <span>{formatearMonto(presupuesto.subtotal_usd)}</span>
              </div>
              {presupuesto.descuento_usd > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span>Descuento:</span>
                  <span>-{formatearMonto(presupuesto.descuento_usd)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-sans font-bold text-sm uppercase text-foreground">
                  Total USD:
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ${presupuesto.total_usd.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                <span className="font-sans font-medium uppercase">
                  Equiv. Ref. Bs:
                </span>
                <span className="font-bold text-foreground">
                  Bs. {(presupuesto.total_usd * tasa).toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 size-4" /> Imprimir Cotización
            </Button>
            {puedeConvertirse && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelar}
                disabled={cancelando}
              >
                <Ban className="mr-2 size-4" /> Cancelar Presupuesto
              </Button>
            )}
          </div>

          {puedeConvertirse && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                onOpenChange(false);
                onConvertir(presupuesto);
              }}
            >
              <CheckCircle2 className="mr-2 size-4" /> Convertir a Factura
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
