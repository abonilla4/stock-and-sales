"use client";

import { useState, useEffect } from "react";
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
import { ArrowDownUp, Loader2, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { registrarMovimiento } from "@/app/dashboard/inventario/actions";
import { crearProveedor } from "@/app/dashboard/configuracion/proveedores/actions";
import { esUnidadEntera, getStepPorUnidad } from "@/lib/precision";

interface ProveedorSimple {
  id: string;
  nombre: string;
}

interface MovimientoDialogProps {
  productoId: string;
  productoNombre: string;
  stockActual: number;
  unidadMedida: string;
  proveedores?: ProveedorSimple[];
  proveedorIdActual?: string | null;
  proveedorNombreActual?: string | null;
  children?: React.ReactNode;
}

export function MovimientoDialog({
  productoId,
  productoNombre,
  stockActual,
  unidadMedida,
  proveedores = [],
  proveedorIdActual,
  proveedorNombreActual,
  children,
}: MovimientoDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [selectedProveedor, setSelectedProveedor] = useState("");
  const [confirmandoCambioProveedor, setConfirmandoCambioProveedor] = useState(false);

  // Gestión de creación rápida de proveedor
  const [listaProveedores, setListaProveedores] = useState<ProveedorSimple[]>(proveedores);
  const [showNuevoProveedor, setShowNuevoProveedor] = useState(false);
  const [nuevoProvNombre, setNuevoProvNombre] = useState("");
  const [nuevoProvTelefono, setNuevoProvTelefono] = useState("");
  const [loadingProveedor, setLoadingProveedor] = useState(false);

  useEffect(() => {
    setListaProveedores(proveedores);
  }, [proveedores]);

  const cantidadNum = parseFloat(cantidad) || 0;
  const nuevoStock =
    tipo === "entrada"
      ? stockActual + cantidadNum
      : stockActual - cantidadNum;
  const stockNegativo = nuevoStock < 0;

  async function handleCrearProveedorRapido() {
    if (!nuevoProvNombre.trim()) {
      toast.error("Ingresa el nombre del proveedor");
      return;
    }
    setLoadingProveedor(true);
    try {
      const formData = new FormData();
      formData.append("nombre", nuevoProvNombre.trim());
      if (nuevoProvTelefono.trim()) {
        formData.append("telefono", nuevoProvTelefono.trim());
      }
      const res = await crearProveedor(formData);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(`Proveedor "${nuevoProvNombre.trim()}" creado`);
      if ("id" in res && typeof res.id === "string") {
        const newId: string = res.id;
        const nuevoObj: ProveedorSimple = { id: newId, nombre: nuevoProvNombre.trim() };
        setListaProveedores((prev) => [...prev, nuevoObj]);
        setSelectedProveedor(newId);
      }
      setShowNuevoProveedor(false);
      setNuevoProvNombre("");
      setNuevoProvTelefono("");
    } catch {
      toast.error("Error inesperado al crear proveedor");
    } finally {
      setLoadingProveedor(false);
    }
  }

  const provNuevoNombre = listaProveedores.find((p) => p.id === selectedProveedor)?.nombre ?? "Nuevo proveedor";
  const provNombreActualText = proveedorNombreActual || "otro proveedor";

  async function ejecutarSubmit(proveedorIdAEnviar: string | null) {
    const cantNum = parseFloat(cantidad);
    if (esUnidadEntera(unidadMedida) && !Number.isInteger(cantNum)) {
      toast.error(`Para la unidad "${unidadMedida}", la cantidad debe ser un número entero sin decimales.`);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("producto_id", productoId);
      formData.set("tipo", tipo);
      formData.set("cantidad", cantidad);
      formData.set("motivo", motivo);
      if (tipo === "entrada" && proveedorIdAEnviar) {
        formData.set("proveedor_id", proveedorIdAEnviar);
      }

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

  async function handleSubmit() {
    // Si es entrada y se seleccionó un proveedor distinto al actual del producto, solicitar confirmación
    if (
      tipo === "entrada" &&
      selectedProveedor &&
      selectedProveedor !== "none" &&
      proveedorIdActual &&
      selectedProveedor !== proveedorIdActual &&
      !confirmandoCambioProveedor
    ) {
      setConfirmandoCambioProveedor(true);
      return;
    }

    await ejecutarSubmit(tipo === "entrada" && selectedProveedor !== "none" ? selectedProveedor : null);
  }

  function resetForm() {
    setTipo("entrada");
    setCantidad("");
    setMotivo("");
    setSelectedProveedor("");
    setConfirmandoCambioProveedor(false);
    setShowNuevoProveedor(false);
    setNuevoProvNombre("");
    setNuevoProvTelefono("");
  }

  return (
    <Dialog
      open={open}
      disablePointerDismissal={true}
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
          {/* Tipo de Movimiento */}
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as "entrada" | "salida")}
            >
              <SelectTrigger className="w-full h-10 text-sm">
                <SelectValue placeholder="Seleccionar tipo">
                  {tipo === "entrada"
                    ? "📦 Entrada (compra / reposición)"
                    : "📤 Salida (merma / daño / ajuste)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-full">
                <SelectItem value="entrada">
                  📦 Entrada (compra / reposición)
                </SelectItem>
                <SelectItem value="salida">
                  📤 Salida (merma / daño / ajuste)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selector de Proveedor (solo en Entradas) */}
          {tipo === "entrada" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Proveedor (Opcional)</Label>
                <button
                  type="button"
                  onClick={() => setShowNuevoProveedor(!showNuevoProveedor)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="size-3" /> {showNuevoProveedor ? "Cerrar" : "Crear proveedor"}
                </button>
              </div>

              {showNuevoProveedor ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Nuevo Proveedor</span>
                    <button
                      type="button"
                      onClick={() => setShowNuevoProveedor(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Nombre / RIF de la empresa *"
                      value={nuevoProvNombre}
                      onChange={(e) => setNuevoProvNombre(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    <Input
                      placeholder="Teléfono (Opcional)"
                      value={nuevoProvTelefono}
                      onChange={(e) => setNuevoProvTelefono(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-8 text-xs font-medium"
                    disabled={loadingProveedor || !nuevoProvNombre.trim()}
                    onClick={handleCrearProveedorRapido}
                  >
                    {loadingProveedor ? "Guardando..." : "Guardar y Seleccionar"}
                  </Button>
                </div>
              ) : (
                <Select
                  value={selectedProveedor}
                  onValueChange={(v) => setSelectedProveedor(v ?? "")}
                >
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder="Seleccionar proveedor">
                      {selectedProveedor
                        ? listaProveedores.find((p) => p.id === selectedProveedor)?.nombre ?? "Seleccionar proveedor"
                        : "Sin proveedor especificado"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    <SelectItem value="none">Sin proveedor especificado</SelectItem>
                    {listaProveedores.map((prov) => (
                      <SelectItem key={prov.id} value={prov.id}>
                        {prov.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Cantidad */}
          <div className="space-y-2">
            <Label htmlFor="mov-cantidad">Cantidad</Label>
            <Input
              id="mov-cantidad"
              type="number"
              step={getStepPorUnidad(unidadMedida)}
              min={esUnidadEntera(unidadMedida) ? "1" : "0.01"}
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
                  ? "Ej: Compra según factura #123"
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

          {/* Advertencia / Confirmación de cambio de proveedor */}
          {confirmandoCambioProveedor && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>¿Confirmar cambio de proveedor principal?</span>
              </div>
              <p className="text-muted-foreground">
                Este producto tiene a <strong className="text-foreground">{provNombreActualText}</strong> como proveedor principal — ¿deseas cambiarlo a <strong className="text-foreground">{provNuevoNombre}</strong>?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => ejecutarSubmit(selectedProveedor)}
                >
                  Sí, cambiar a {provNuevoNombre}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => ejecutarSubmit(null)}
                >
                  No, mantener {provNombreActualText}
                </Button>
              </div>
            </div>
          )}

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
