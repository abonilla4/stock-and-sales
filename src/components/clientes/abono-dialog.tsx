"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
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
  DollarSign,
  Banknote,
  Smartphone,
  Building2,
  CreditCard,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import type { Cliente, MetodoPago } from "@/lib/types/database";
import { registrarAbonoCliente } from "@/app/dashboard/clientes/actions";

interface AbonoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente;
  tasaActiva: number;
}

const METODOS_PAGO_OPCIONES: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { value: "efectivo_usd", label: "Efectivo Dólares (USD)", icon: <Banknote className="size-4 text-emerald-500" /> },
  { value: "efectivo_bs", label: "Efectivo Bolívares (Bs)", icon: <Banknote className="size-4 text-blue-500" /> },
  { value: "pago_movil", label: "Pago Móvil", icon: <Smartphone className="size-4 text-purple-500" /> },
  { value: "transferencia", label: "Transferencia Bancaria", icon: <Building2 className="size-4 text-indigo-500" /> },
  { value: "tarjeta", label: "Tarjeta de Débito / Crédito", icon: <CreditCard className="size-4 text-amber-500" /> },
];

export function AbonoDialog({
  open,
  onOpenChange,
  cliente,
  tasaActiva,
}: AbonoDialogProps) {
  const router = useRouter();
  const [moneda, setMoneda] = useState<"USD" | "BS">("USD");
  const [montoIngresado, setMontoIngresado] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("pago_movil");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);

  const saldoUsdActual = Number((cliente.saldo_fiado || 0).toFixed(2));
  const saldoBsActual = Number((saldoUsdActual * tasaActiva).toFixed(2));

  const montoNum = parseFloat(montoIngresado) || 0;

  // Calcular abono equivalente en USD y Bs
  const montoUsd = moneda === "USD" ? montoNum : tasaActiva > 0 ? montoNum / tasaActiva : 0;
  const montoBs = moneda === "BS" ? montoNum : montoNum * tasaActiva;

  const montoUsdFinal = Number(montoUsd.toFixed(2));
  const montoBsFinal = Number(montoBs.toFixed(2));

  const nuevoSaldoUsd = Math.max(0, Number((saldoUsdActual - montoUsdFinal).toFixed(2)));
  const nuevoSaldoBs = Number((nuevoSaldoUsd * tasaActiva).toFixed(2));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (montoUsdFinal <= 0) {
      toast.error("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    setLoading(true);

    try {
      const res = await registrarAbonoCliente({
        cliente_id: cliente.id,
        monto_usd: montoUsdFinal,
        monto_bs: montoBsFinal,
        metodo_pago: metodoPago,
        notas: notas.trim() || null,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(`Abono de $${montoUsdFinal.toFixed(2)} USD registrado correctamente.`);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error inesperado al procesar el abono.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-2">
            <DollarSign className="size-6" />
          </div>
          <DialogTitle className="text-center text-lg font-bold">
            Registrar Abono / Pago de Fiado
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            Cliente: <strong className="text-foreground">{cliente.nombre}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Resumen de saldo actual */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Saldo pendiente actual:</span>
            <span className="font-semibold text-foreground">
              ${saldoUsdActual.toFixed(2)} USD (Bs. {saldoBsActual.toFixed(2)})
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tasa de cambio del día:</span>
            <span className="font-mono">Bs. {tasaActiva.toFixed(2)} / USD</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Selector de Moneda */}
          <div className="space-y-2">
            <Label className="text-xs">Moneda en la que recibe el abono</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={moneda === "USD" ? "default" : "outline"}
                size="sm"
                onClick={() => setMoneda("USD")}
                className="w-full"
              >
                💵 Dólares (USD)
              </Button>
              <Button
                type="button"
                variant={moneda === "BS" ? "default" : "outline"}
                size="sm"
                onClick={() => setMoneda("BS")}
                className="w-full"
              >
                🇻🇪 Bolívares (Bs)
              </Button>
            </div>
          </div>

          {/* Campo de Monto */}
          <div className="space-y-2">
            <Label htmlFor="monto">
              Monto a abonar ({moneda === "USD" ? "USD $" : "Bs. Bolívares"}) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-sm text-muted-foreground">
                {moneda === "USD" ? "$" : "Bs."}
              </span>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0.01"
                placeholder={moneda === "USD" ? "Ej: 20.00" : `Ej: ${Math.ceil(saldoBsActual / 2)}`}
                value={montoIngresado}
                onChange={(e) => setMontoIngresado(e.target.value)}
                className="pl-9 font-semibold text-base"
                autoFocus
                required
              />
            </div>

            {/* Conversión equivalente en tiempo real */}
            {montoNum > 0 && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Equivalente:{" "}
                {moneda === "USD"
                  ? `Bs. ${montoBsFinal.toFixed(2)}`
                  : `$${montoUsdFinal.toFixed(2)} USD`}
              </p>
            )}
          </div>

          {/* Método de pago */}
          <div className="space-y-2">
            <Label>Método de Pago</Label>
            <Select value={metodoPago} onValueChange={(v) => setMetodoPago((v ?? "pago_movil") as MetodoPago)}>
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

          {/* Notas u observaciones */}
          <div className="space-y-2">
            <Label htmlFor="notas-pago">Referencia / Notas (Opcional)</Label>
            <Textarea
              id="notas-pago"
              placeholder="Número de referencia bancaria o concepto..."
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Proyección del Saldo Resultante */}
          {montoUsdFinal > 0 && (
            <div className="rounded-lg border bg-emerald-50/60 p-3 space-y-1 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <div className="flex items-center justify-between font-semibold">
                <span>Nuevo saldo restante:</span>
                <span className="font-mono text-sm">
                  ${nuevoSaldoUsd.toFixed(2)} USD (Bs. {nuevoSaldoBs.toFixed(2)})
                </span>
              </div>
              {nuevoSaldoUsd === 0 && (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  🎉 ¡El saldo quedará completamente en cero (Al día)!
                </p>
              )}
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
            <Button type="submit" disabled={loading || montoUsdFinal <= 0}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar Abono (${montoUsdFinal.toFixed(2)})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
