"use client";

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
import { CheckCircle2, Printer, ArrowRight, DollarSign } from "lucide-react";
import type { MetodoPago } from "@/lib/types/database";

export interface ReciboVentaData {
  venta_id: string;
  fecha: string;
  total_usd: number;
  total_bs: number;
  tasa_cambio_aplicada: number;
  subtotal_usd?: number;
  descuento_usd?: number;
  metodo_pago?: MetodoPago;
  cliente_nombre?: string;
  items?: {
    nombre: string;
    cantidad: number;
    unidad_medida: string;
    precio_unitario_usd: number;
    subtotal_usd: number;
  }[];
}

interface PosReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recibo: ReciboVentaData | null;
  onNuevaVenta: () => void;
}

const METODOS_PAGO_LABELS: Record<MetodoPago, string> = {
  efectivo_usd: "Efectivo USD",
  efectivo_bs: "Efectivo Bolívares (Bs)",
  pago_movil: "Pago Móvil",
  transferencia: "Transferencia Bancaria",
  tarjeta: "Tarjeta de Débito / Crédito",
  fiado: "Crédito",
};

export function PosReceiptDialog({
  open,
  onOpenChange,
  recibo,
  onNuevaVenta,
}: PosReceiptDialogProps) {
  if (!recibo) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    onOpenChange(false);
    onNuevaVenta();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-2">
            <CheckCircle2 className="size-7" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            ¡Venta Registrada Exitosamente!
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-mono">
            Comprobante Nº: {recibo.venta_id.substring(0, 8).toUpperCase()}
          </p>
        </DialogHeader>

        {/* Formato de Recibo Imprimible */}
        <div id="recibo-print" className="space-y-4 rounded-lg border bg-card p-4 text-xs font-mono">
          <div className="text-center space-y-1">
            <h3 className="font-sans font-bold text-sm text-foreground">FERRETERÍA STOCK & SALES</h3>
            <p className="text-muted-foreground text-[11px]">Sistema de Control de Inventario y Ventas</p>
            <p className="text-muted-foreground text-[10px]">
              {new Date(recibo.fecha).toLocaleString("es-VE", {
                dateStyle: "medium",
                timeStyle: "medium",
              })}
            </p>
          </div>

          <Separator />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-semibold text-foreground">
                {recibo.cliente_nombre ?? "Venta de contado"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Método de pago:</span>
              <span className="font-semibold text-foreground">
                {recibo.metodo_pago ? METODOS_PAGO_LABELS[recibo.metodo_pago] : "Confirmado"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tasa de cambio:</span>
              <span className="font-semibold text-foreground">
                Bs. {recibo.tasa_cambio_aplicada.toFixed(2)} / USD
              </span>
            </div>
          </div>

          {/* Lista de productos si están disponibles */}
          {recibo.items && recibo.items.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="grid grid-cols-12 font-bold text-muted-foreground border-b pb-1 text-[11px]">
                  <span className="col-span-6">Descripción</span>
                  <span className="col-span-2 text-center">Cant</span>
                  <span className="col-span-4 text-right">Total USD</span>
                </div>
                {recibo.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 text-[11px]">
                    <span className="col-span-6 truncate font-medium">{item.nombre}</span>
                    <span className="col-span-2 text-center">{item.cantidad}</span>
                    <span className="col-span-4 text-right">${item.subtotal_usd.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Resumen de totales */}
          <div className="space-y-1 text-sm font-sans pt-1">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-muted-foreground text-xs uppercase">Total USD</span>
              <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                ${recibo.total_usd.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-muted-foreground text-xs uppercase">Total Bs.</span>
              <span className="font-bold text-sm text-foreground">
                Bs. {recibo.total_bs.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 size-4" /> Imprimir Recibo
          </Button>

          <Button size="sm" onClick={handleClose}>
            Siguiente Venta <ArrowRight className="ml-2 size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
