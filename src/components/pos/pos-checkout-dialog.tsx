"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  UserCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { Cliente, MetodoPago } from "@/lib/types/database";
import { usePosCart } from "./pos-cart-context";
import { confirmarVentaPOS } from "@/app/dashboard/pos/actions";
import { AdminAuthDialog } from "./admin-auth-dialog";
import { PosReceiptDialog, type ReciboVentaData } from "./pos-receipt-dialog";

interface PosCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
  isAdmin: boolean;
  tieneStockInsuficiente: boolean;
  onVentaExitosa: (recibo: ReciboVentaData) => void;
}

const METODOS_PAGO_OPCIONES: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { value: "efectivo_usd", label: "Efectivo Dólares (USD)", icon: <Banknote className="size-4 text-emerald-500" /> },
  { value: "efectivo_bs", label: "Efectivo Bolívares (Bs)", icon: <Banknote className="size-4 text-blue-500" /> },
  { value: "pago_movil", label: "Pago Móvil", icon: <Smartphone className="size-4 text-purple-500" /> },
  { value: "transferencia", label: "Transferencia Bancaria", icon: <Building2 className="size-4 text-indigo-500" /> },
  { value: "tarjeta", label: "Tarjeta de Débito / Crédito", icon: <CreditCard className="size-4 text-amber-500" /> },
  { value: "fiado", label: "Crédito / Fiado", icon: <UserCheck className="size-4 text-red-500" /> },
];

export function PosCheckoutDialog({
  open,
  onOpenChange,
  clientes,
  isAdmin,
  tieneStockInsuficiente,
  onVentaExitosa,
}: PosCheckoutDialogProps) {
  const {
    items,
    descuentoUsd,
    tasaActiva,
    subtotalUsd,
    totalUsd,
    totalBs,
  } = usePosCart();

  const [clienteId, setClienteId] = useState<string>("contado");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo_usd");
  const [montoRecibidoBs, setMontoRecibidoBs] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Modal de autorización admin cuando hay stock insuficiente
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);
  const [autorizadoPorAdmin, setAutorizadoPorAdmin] = useState(false);

  // Cálculo de vuelto para efectivo Bs
  const montoRecibidoNum = parseFloat(montoRecibidoBs) || 0;
  const vueltoBs = Math.max(0, montoRecibidoNum - totalBs);

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  const ejecutarConfirmacionVenta = async (permitirStockNegativo: boolean = false) => {
    setLoading(true);
    try {
      const itemsPayload = items.map((i) => ({
        producto_id: i.producto.id,
        cantidad: i.cantidad,
        precio_unitario_usd: i.precio_unitario_usd,
        subtotal_usd: i.subtotal_usd,
      }));

      const res = await confirmarVentaPOS({
        cliente_id: clienteId === "contado" ? null : clienteId,
        subtotal_usd: subtotalUsd,
        descuento_usd: descuentoUsd,
        total_usd: totalUsd,
        tasa_cambio_aplicada: tasaActiva,
        total_bs: totalBs,
        metodo_pago: metodoPago,
        items: itemsPayload,
        permitir_stock_negativo: permitirStockNegativo,
      });

      if (res.error) {
        if (res.esErrorStock) {
          // Abrir modal de autorización si falta stock
          toast.warning("Stock insuficiente. Se requiere autorización de Administrador.");
          setAdminAuthOpen(true);
        } else {
          toast.error(res.error);
        }
        return;
      }

      if (res.success && res.recibo) {
        toast.success("Venta procesada exitosamente.");
        const reciboObj: ReciboVentaData = {
          venta_id: res.recibo.venta_id,
          fecha: res.recibo.fecha,
          total_usd: res.recibo.total_usd,
          total_bs: res.recibo.total_bs,
          tasa_cambio_aplicada: res.recibo.tasa_cambio_aplicada,
          subtotal_usd: subtotalUsd,
          descuento_usd: descuentoUsd,
          metodo_pago: metodoPago,
          cliente_nombre: clienteSeleccionado?.nombre,
          items: items.map((i) => ({
            nombre: i.producto.nombre,
            cantidad: i.cantidad,
            unidad_medida: i.producto.unidad_medida,
            precio_unitario_usd: i.precio_unitario_usd,
            subtotal_usd: i.subtotal_usd,
          })),
        };

        onOpenChange(false);
        onVentaExitosa(reciboObj);
      }
    } catch {
      toast.error("Error al procesar la transacción.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (metodoPago === "fiado" && clienteId === "contado") {
      toast.error("Para ventas fiadas / a crédito debes seleccionar un cliente registrado.");
      return;
    }

    if (tieneStockInsuficiente && !autorizadoPorAdmin) {
      setAdminAuthOpen(true);
      return;
    }

    ejecutarConfirmacionVenta(autorizadoPorAdmin);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" /> Confirmar y Cobrar Venta
            </DialogTitle>
            <DialogDescription>
              Selecciona el cliente y método de pago. La tasa aplicada quedará registrada como snapshot congelado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmarSubmit} className="space-y-4 py-2">
            {/* Selección de Cliente */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={(v) => setClienteId(v ?? "contado")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">🛒 Venta de contado (Sin cliente registrado)</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      👤 {c.nombre} {c.identificacion ? `(${c.identificacion})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selección de Método de Pago */}
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(v) => setMetodoPago((v ?? "efectivo_usd") as MetodoPago)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO_OPCIONES.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      <div className="flex items-center gap-2">
                        {opcion.icon}
                        <span>{opcion.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Calculadora de vuelto si es efectivo en Bs */}
            {metodoPago === "efectivo_bs" && (
              <div className="rounded-lg border bg-blue-50/50 p-3 space-y-2 dark:bg-blue-950/20">
                <Label htmlFor="monto-recibido" className="text-xs">
                  Monto recibido en efectivo (Bs)
                </Label>
                <Input
                  id="monto-recibido"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Ej: ${Math.ceil(totalBs)}`}
                  value={montoRecibidoBs}
                  onChange={(e) => setMontoRecibidoBs(e.target.value)}
                  className="h-8 text-sm"
                />

                {montoRecibidoNum > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-blue-900 dark:text-blue-300 pt-1">
                    <span>Vuelto a entregar:</span>
                    <span className="font-mono font-bold">Bs. {vueltoBs.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Resumen de totales y tasa aplicada */}
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Tasa aplicada (Snapshot):</span>
                <span className="font-mono font-semibold text-foreground">
                  Bs. {tasaActiva.toFixed(2)} / USD
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold pt-1">
                <span>Total USD:</span>
                <span className="text-emerald-600 dark:text-emerald-400">${totalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Bolívares (Bs):</span>
                <span>Bs. {totalBs.toFixed(2)}</span>
              </div>
            </div>

            {/* Advertencia de stock insuficiente si aplica */}
            {tieneStockInsuficiente && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="size-4 text-amber-600" />
                  <span>Requiere Autorización de Administrador</span>
                </div>
                <p>
                  {autorizadoPorAdmin
                    ? "✓ Venta previamente autorizada por clave Admin."
                    : "Al hacer clic en Confirmar, se solicitará la clave de Administrador para descontar el stock e ingresar unidades negativas auditadas."}
                </p>
              </div>
            )}

            <DialogFooter className="sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="px-6 font-semibold">
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Confirmar Venta (${totalUsd.toFixed(2)})
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de clave Admin si requiere autorización */}
      {adminAuthOpen && (
        <AdminAuthDialog
          open={adminAuthOpen}
          onOpenChange={setAdminAuthOpen}
          onAutorizado={() => {
            setAutorizadoPorAdmin(true);
            ejecutarConfirmacionVenta(true);
          }}
        />
      )}
    </>
  );
}
