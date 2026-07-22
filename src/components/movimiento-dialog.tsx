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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownUp, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { registrarMovimiento } from "@/app/dashboard/inventario/actions";

interface MovimientoDialogProps {
  productoId: string;
  productoNombre: string;
  stockActual: number;
  unidadMedida: string;
  children?: React.ReactNode;
}

export function MovimientoDialog({
  productoId,
  productoNombre,
  stockActual,
  unidadMedida,
  children,
}: MovimientoDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const cantidadNum = parseFloat(cantidad) || 0;
  const nuevoStock =
    tipo === "entrada"
      ? stockActual + cantidadNum
      : stockActual - cantidadNum;
  const stockNegativo = nuevoStock < 0;

  async function handleSubmit() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("producto_id", productoId);
      formData.set("tipo", tipo);
      formData.set("cantidad", cantidad);
      formData.set("motivo", motivo);

      const result = await registrarMovimiento(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.advertencia) {
        toast.warning(result.advertencia);
      } else {
        toast.success("Movimiento registrado exitosamente");
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTipo("entrada");
    setCantidad("");
    setMotivo("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      {children ? (
        <DialogTrigger render={children as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={<Button variant="outline" size="sm" />}
        >
          <ArrowDownUp className="size-4" />
          Registrar movimiento
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            {productoNombre} — Stock actual:{" "}
            <span className="font-semibold text-foreground">
              {stockActual} {unidadMedida}(s)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as "entrada" | "salida")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">
                  📦 Entrada (compra / reposición)
                </SelectItem>
                <SelectItem value="salida">
                  📤 Salida (merma / daño / ajuste)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <Label htmlFor="mov-cantidad">Cantidad</Label>
            <Input
              id="mov-cantidad"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="mov-motivo">
              Motivo{" "}
              {tipo === "salida" && (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Textarea
              id="mov-motivo"
              placeholder={
                tipo === "entrada"
                  ? "Ej: Compra a proveedor X"
                  : "Ej: Merma por daño en almacén"
              }
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
            {tipo === "salida" && (
              <p className="text-xs text-muted-foreground">
                Obligatorio para salidas y ajustes.
              </p>
            )}
          </div>

          {/* Preview de stock resultante */}
          {cantidadNum > 0 && (
            <div
              className={`rounded-lg border p-3 ${
                stockNegativo
                  ? "border-destructive/50 bg-destructive/5"
                  : "border-border bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Stock resultante:</span>
                <span
                  className={`font-semibold ${
                    stockNegativo ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {nuevoStock} {unidadMedida}(s)
                </span>
              </div>
              {stockNegativo && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  <span>
                    El stock quedará negativo. Se permite pero requiere
                    revisión.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || cantidadNum <= 0}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
