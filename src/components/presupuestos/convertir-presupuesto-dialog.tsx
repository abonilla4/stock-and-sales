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
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  ShoppingCart,
  CheckCircle2,
  DollarSign,
  Coins,
  CreditCard,
  Building2,
  Phone,
  HandCoins,
  ShieldAlert,
} from "lucide-react";
import type { MetodoPago } from "@/lib/types/database";
import type { DetallePresupuestoCompleto } from "@/app/dashboard/presupuestos/actions";
import { confirmarVentaPOS } from "@/app/dashboard/pos/actions";
import { AdminAuthDialog } from "@/components/pos/admin-auth-dialog";
import { toast } from "sonner";
import type { ReciboVentaData } from "@/components/pos/pos-receipt-dialog";

interface ConvertirPresupuestoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presupuesto: DetallePresupuestoCompleto | null;
  tasaActiva: number;
  isAdmin: boolean;
  onConversionExitosa: (recibo: ReciboVentaData) => void;
}

const METODOS_PAGO: { id: MetodoPago; label: string; icon: any }[] = [
  { id: "efectivo_usd", label: "Efectivo USD", icon: DollarSign },
  { id: "efectivo_bs", label: "Efectivo Bs", icon: Coins },
  { id: "pago_movil", label: "Pago Móvil", icon: Phone },
  { id: "transferencia", label: "Transferencia", icon: Building2 },
  { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { id: "fiado", label: "Crédito / Fiado", icon: HandCoins },
];

export function ConvertirPresupuestoDialog({
  open,
  onOpenChange,
  presupuesto,
  tasaActiva,
  isAdmin,
  onConversionExitosa,
}: ConvertirPresupuestoDialogProps) {
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo_usd");
  const [procesando, setProcesando] = useState(false);
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);
  const [adminAuthMotivo, setAdminAuthMotivo] = useState("");
  const [permiteStockNegativo, setPermiteStockNegativo] = useState(false);

  if (!presupuesto) return null;

  // Recalcular subtotal y total contra precios reales del catálogo para la venta
  let subtotalCatalogoUsd = 0;
  let hayDiferenciaPrecios = false;
  let hayStockInsuficiente = false;

  const itemsVenta = presupuesto.detalles.map((det) => {
    const precioCatalogo = Number(det.producto?.precio_venta_usd ?? det.precio_unitario_usd_referencia);
    const subtotalLinea = Math.round(det.cantidad * precioCatalogo * 100) / 100;
    subtotalCatalogoUsd += subtotalLinea;

    if (det.precio_actual_cambio) hayDiferenciaPrecios = true;
    if (det.stock_insuficiente) hayStockInsuficiente = true;

    return {
      producto_id: det.producto_id,
      cantidad: det.cantidad,
      precio_unitario_usd: precioCatalogo,
      subtotal_usd: subtotalLinea,
    };
  });

  subtotalCatalogoUsd = Math.round(subtotalCatalogoUsd * 100) / 100;
  const descuentoUsd = Math.min(subtotalCatalogoUsd, presupuesto.descuento_usd);
  const totalUsd = Math.max(0, Math.round((subtotalCatalogoUsd - descuentoUsd) * 100) / 100);
  const totalBs = Math.round(totalUsd * (tasaActiva || 1) * 100) / 100;

  const ejecutarVenta = async (autorizadoPorAdminId?: string | null) => {
    setProcesando(true);
    try {
      const res = await confirmarVentaPOS({
        cliente_id: presupuesto.cliente_id,
        subtotal_usd: subtotalCatalogoUsd,
        descuento_usd: descuentoUsd,
        total_usd: totalUsd,
        tasa_cambio_aplicada: tasaActiva || 1,
        total_bs: totalBs,
        metodo_pago: metodoPago,
        items: itemsVenta,
        permitir_stock_negativo: permiteStockNegativo || !!autorizadoPorAdminId,
        autorizado_por: autorizadoPorAdminId ?? null,
        origen_autorizacion: autorizadoPorAdminId ? "admin_online" : null,
        presupuesto_id: presupuesto.id,
      });

      if (res.error) {
        if (res.esErrorStock || res.error.includes("autorización") || res.error.includes("descuento")) {
          setAdminAuthMotivo(res.error);
          setAdminAuthOpen(true);
        } else {
          toast.error(res.error);
        }
        return;
      }

      if (res.success && res.recibo) {
        toast.success(`¡Presupuesto ${presupuesto.folio} convertido a factura exitosamente!`);
        onOpenChange(false);
        onConversionExitosa({
          ...res.recibo,
          subtotal_usd: subtotalCatalogoUsd,
          descuento_usd: descuentoUsd,
          metodo_pago: metodoPago,
          cliente_nombre: presupuesto.cliente?.nombre ?? "Venta de contado",
          items: presupuesto.detalles.map((d) => ({
            nombre: d.producto?.nombre ?? "Producto",
            cantidad: d.cantidad,
            unidad_medida: d.producto?.unidad_medida ?? "unidad",
            precio_unitario_usd: Number(d.producto?.precio_venta_usd ?? d.precio_unitario_usd_referencia),
            subtotal_usd: Number(d.subtotal_usd),
          })),
        });
      }
    } catch (err: any) {
      toast.error("Error al procesar la venta: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmar = () => {
    if (metodoPago === "fiado" && !presupuesto.cliente_id) {
      toast.error("Las ventas a crédito/fiado requieren que el presupuesto tenga un cliente registrado asignado.");
      return;
    }

    if (hayStockInsuficiente) {
      setPermiteStockNegativo(true);
      setAdminAuthMotivo("Uno o más productos del presupuesto tienen stock actual insuficiente en inventario.");
      setAdminAuthOpen(true);
      return;
    }

    ejecutarVenta();
  };

  const handleAdminAutorizado = (adminUserId: string) => {
    setAdminAuthOpen(false);
    setPermiteStockNegativo(true);
    ejecutarVenta(adminUserId);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              <DialogTitle className="text-lg font-bold">
                Convertir Presupuesto a Factura
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Folio: {presupuesto.folio} · Cliente: {presupuesto.cliente?.nombre ?? "Contado (Genérico)"}
            </p>
          </DialogHeader>

          {/* Advertencia de Vigencia Vencida */}
          {presupuesto.es_vencido && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Presupuesto con vigencia vencida
              </div>
              <p>
                Los precios y el inventario disponible se están revalidando en tiempo real contra el catálogo activo antes de emitir la factura.
              </p>
            </div>
          )}

          {/* Advertencia de Cambio de Precios en Catálogo */}
          {hayDiferenciaPrecios && (
            <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-2.5 text-xs text-blue-800 dark:text-blue-300">
              ℹ️ Uno o más productos sufrieron cambios de precio en el catálogo desde la cotización original. El total a cobrar ha sido actualizado.
            </div>
          )}

          {/* Advertencia de Stock Insuficiente */}
          {hayStockInsuficiente && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <ShieldAlert className="size-4 shrink-0 text-rose-600" />
              <span>Hay productos con stock insuficiente. Se requerirá autorización de Administrador para proceder.</span>
            </div>
          )}

          {/* Resumen de Cobro y Método de Pago */}
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Método de Pago
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {METODOS_PAGO.map((m) => {
                  const Icon = m.icon;
                  const isSelected = metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                          : "border-border hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cuadro de Totales Reales */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2 font-mono">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal:</span>
                <span>${subtotalCatalogoUsd.toFixed(2)}</span>
              </div>
              {descuentoUsd > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                  <span>Descuento aplicado:</span>
                  <span>-${descuentoUsd.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tasa activa actual:</span>
                <span>Bs. {tasaActiva.toFixed(2)} / USD</span>
              </div>

              <div className="border-t pt-2 flex justify-between items-baseline">
                <span className="font-sans font-bold text-sm uppercase text-foreground">
                  Total a Facturar:
                </span>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    ${totalUsd.toFixed(2)}
                  </span>
                  <p className="text-xs font-bold text-foreground font-sans">
                    Bs. {totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={procesando}
            >
              Volver
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              onClick={handleConfirmar}
              disabled={procesando}
            >
              <CheckCircle2 className="mr-2 size-4" />
              {procesando ? "Facturando..." : "Confirmar Venta / Facturar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Autorización de Administrador si stock es negativo o descuento > 5% */}
      <AdminAuthDialog
        open={adminAuthOpen}
        onOpenChange={setAdminAuthOpen}
        onAutorizado={handleAdminAutorizado}
        motivo={adminAuthMotivo}
      />
    </>
  );
}
