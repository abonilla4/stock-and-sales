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
import { procesarVentaPOS } from "@/lib/offline/sales-manager";
import { useOfflineNetwork } from "@/components/offline-network-context";
import { AdminAuthDialog } from "./admin-auth-dialog";
import { PosReceiptDialog, type ReciboVentaData } from "./pos-receipt-dialog";

import { formatUSD, formatBs } from "@/lib/formatters";
import { MAX_DESCUENTO_PORCENTAJE_SIN_AUTORIZACION } from "@/lib/config/limites";
import type { PermisoAutorizacion } from "@/lib/schemas/actions-schemas";

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
  { value: "fiado", label: "Crédito", icon: <UserCheck className="size-4 text-red-500" /> },
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

  const { isSimulatedOffline, isOnline, refreshPendingCount } = useOfflineNetwork();

  const [clienteId, setClienteId] = useState<string>("contado");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo_usd");
  const [montoRecibidoBs, setMontoRecibidoBs] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Modal de autorización admin cuando hay stock insuficiente o descuento mayor al límite
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);
  const [autorizadoPorAdmin, setAutorizadoPorAdmin] = useState(false);

  // Verificación de límite de descuento (5%)
  const porcentajeDescuento = subtotalUsd > 0 ? (descuentoUsd / subtotalUsd) * 100 : 0;
  const excedeDescuentoPermitido = porcentajeDescuento > MAX_DESCUENTO_PORCENTAJE_SIN_AUTORIZACION;
  const requiereAutorizacionAdmin = tieneStockInsuficiente || excedeDescuentoPermitido;

  // El autorizador debe tener TODOS los permisos que la venta dispare. Son
  // excepciones distintas y el catálogo las separa: quien puede perdonar un
  // descuento no necesariamente puede vender bajo cero.
  const permisosRequeridos: PermisoAutorizacion[] = [
    ...(tieneStockInsuficiente ? (["ventas.autorizar_stock_negativo"] as const) : []),
    ...(excedeDescuentoPermitido ? (["ventas.autorizar_descuento"] as const) : []),
  ];

  // Red de seguridad: si el servidor rechaza por stock que el cliente creía
  // suficiente, el arreglo llegaría vacío y el diálogo no podría exigir nada.
  const permisosParaDialogo: PermisoAutorizacion[] =
    permisosRequeridos.length > 0
      ? permisosRequeridos
      : ["ventas.autorizar_stock_negativo"];

  // Cálculo de vuelto para efectivo Bs
  const montoRecibidoNum = parseFloat(montoRecibidoBs) || 0;
  const vueltoBs = Math.max(0, montoRecibidoNum - totalBs);

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);

  const ejecutarConfirmacionVenta = async (permitirStockNegativo: boolean = false, autorizadoPor?: string) => {
    setLoading(true);
    try {
      const itemsPayload = items.map((i) => ({
        producto_id: i.producto.id,
        cantidad: i.cantidad,
        precio_unitario_usd: i.precio_unitario_usd,
        subtotal_usd: i.subtotal_usd,
      }));

      const nombresProductosMap: Record<string, string> = {};
      items.forEach((i) => {
        nombresProductosMap[i.producto.id] = i.producto.nombre;
      });

      const res = await procesarVentaPOS(
        {
          cliente_id: clienteId === "contado" ? null : clienteId,
          subtotal_usd: subtotalUsd,
          descuento_usd: descuentoUsd,
          total_usd: totalUsd,
          tasa_cambio_aplicada: tasaActiva,
          total_bs: totalBs,
          metodo_pago: metodoPago,
          items: itemsPayload,
          permitir_stock_negativo: permitirStockNegativo,
          autorizado_por: autorizadoPor ?? null,
        },
        nombresProductosMap,
        clienteSeleccionado?.nombre,
        isSimulatedOffline || !isOnline
      );

      if (!res.success) {
        if (res.esErrorStock) {
          toast.warning("Se requiere autorización de Administrador.");
          setAdminAuthOpen(true);
        } else {
          toast.error(res.error || "Error al procesar la venta.");
        }
        return;
      }

      if (res.success && res.recibo) {
        if (res.esOffline) {
          toast.info("Venta registrada localmente (Modo Offline). Se sincronizará al conectar.");
          await refreshPendingCount();
        } else {
          toast.success("Venta procesada exitosamente en línea.");
        }

        onOpenChange(false);
        onVentaExitosa(res.recibo);
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
      toast.error("Para ventas a crédito debes seleccionar un cliente registrado.");
      return;
    }

    if (requiereAutorizacionAdmin && !autorizadoPorAdmin) {
      setAdminAuthOpen(true);
      return;
    }

    ejecutarConfirmacionVenta(tieneStockInsuficiente || excedeDescuentoPermitido, undefined);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal={true}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" /> Confirmar y Cobrar Venta
            </DialogTitle>
            <DialogDescription>
              Selecciona el cliente y método de pago. La tasa aplicada quedará registrada en la transacción.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmarSubmit} className="space-y-4 py-2">
            {/* Selección de Cliente */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={(v) => setClienteId(v ?? "contado")}>
                <SelectTrigger className="w-full h-10 text-sm">
                  <SelectValue placeholder="Seleccionar cliente">
                    {clienteId === "contado"
                      ? "🛒 Venta de contado (Sin cliente registrado)"
                      : clienteSeleccionado
                      ? `👤 ${clienteSeleccionado.nombre}${clienteSeleccionado.identificacion ? ` (${clienteSeleccionado.identificacion})` : ""}`
                      : "Seleccionar cliente"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-full min-w-[320px]">
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
                <SelectTrigger className="w-full h-10 text-sm">
                  <SelectValue placeholder="Seleccionar método de pago">
                    {(() => {
                      const op = METODOS_PAGO_OPCIONES.find((o) => o.value === metodoPago);
                      return op ? (
                        <div className="flex items-center gap-2">
                          {op.icon}
                          <span>{op.label}</span>
                        </div>
                      ) : (
                        "Seleccionar método de pago"
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-full">
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
                    <span className="font-mono font-bold">{formatBs(vueltoBs)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Resumen de totales y tasa aplicada */}
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Tasa aplicada:</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatBs(tasaActiva)} / USD
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold pt-1">
                <span>Total USD:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatUSD(totalUsd)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Bolívares (Bs):</span>
                <span>{formatBs(totalBs)}</span>
              </div>
            </div>

            {/* Advertencia de autorización de Administrador si requiere por stock o descuento */}
            {requiereAutorizacionAdmin && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="size-4 text-amber-600" />
                  <span>Requiere Autorización de Administrador</span>
                </div>
                <p>
                  {autorizadoPorAdmin
                    ? "✓ Venta previamente autorizada por clave Admin."
                    : excedeDescuentoPermitido && tieneStockInsuficiente
                    ? `El descuento del ${porcentajeDescuento.toFixed(1)}% excede el límite del 5% y existe stock insuficiente. Se requerirá la clave de Administrador.`
                    : excedeDescuentoPermitido
                    ? `El descuento del ${porcentajeDescuento.toFixed(1)}% excede el límite permitido sin autorización (5%). Se requerirá la clave de Administrador.`
                    : "Existe producto con stock insuficiente. Se requerirá la clave de Administrador."}
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
                Confirmar Venta ({formatUSD(totalUsd)})
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
          permisosRequeridos={permisosParaDialogo}
          onAutorizado={(adminUserId) => {
            setAutorizadoPorAdmin(true);
            ejecutarConfirmacionVenta(true, adminUserId);
          }}
        />
      )}
    </>
  );
}
