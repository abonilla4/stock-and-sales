"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type {
  Producto,
  Categoria,
  Proveedor,
  UnidadMedida,
} from "@/lib/types/database";
import { crearProducto, actualizarProducto, generarSku } from "@/app/dashboard/inventario/actions";
import { esUnidadEntera, getStepPorUnidad } from "@/lib/precision";

import { formatUSD, formatNumero } from "@/lib/formatters";

const UNIDADES_MEDIDA: { value: UnidadMedida; label: string }[] = [
  { value: "unidad", label: "Unidad" },
  { value: "caja", label: "Caja" },
  { value: "metro", label: "Metro" },
  { value: "kilo", label: "Kilo" },
  { value: "litro", label: "Litro" },
  { value: "par", label: "Par" },
];

interface ProductoFormProps {
  producto?: Producto;
  categorias: Categoria[];
  proveedores: Proveedor[];
  mode: "crear" | "editar";
}

export function ProductoForm({
  producto,
  categorias,
  proveedores,
  mode,
}: ProductoFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sku, setSku] = useState(producto?.sku ?? "");
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>(
    producto?.unidad_medida ?? "unidad"
  );
  const [selectedCategoria, setSelectedCategoria] = useState(
    producto?.categoria_id ?? ""
  );
  const [selectedProveedor, setSelectedProveedor] = useState(
    producto?.proveedor_id ?? ""
  );

  const [precioCosto, setPrecioCosto] = useState<string>(
    producto?.precio_costo_usd !== undefined ? String(producto.precio_costo_usd) : ""
  );
  const [precioVenta, setPrecioVenta] = useState<string>(
    producto?.precio_venta_usd !== undefined ? String(producto.precio_venta_usd) : ""
  );

  // Auto-generate SKU when category changes (only in create mode)
  useEffect(() => {
    if (mode === "crear" && selectedCategoria && !sku) {
      handleGenerateSku();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoria]);

  async function handleGenerateSku() {
    const cat = categorias.find((c) => c.id === selectedCategoria);
    const catPrefix = cat ? cat.nombre : "";
    const prodText = nombre || descripcion;
    const newSku = await generarSku(catPrefix, prodText);
    setSku(newSku);
  }

  // Cálculos dinámicos de margen de ganancia
  const costoNum = parseFloat(precioCosto) || 0;
  const ventaNum = parseFloat(precioVenta) || 0;

  // Precio sugerido con el 30% de margen sobre el costo
  const precioSugerido30 = costoNum > 0 ? Number((costoNum * 1.30).toFixed(2)) : 0;

  // % de ganancia real actual
  const gananciaUsd = ventaNum - costoNum;
  const porcentajeGanancia = costoNum > 0 ? Number(((gananciaUsd / costoNum) * 100).toFixed(1)) : 0;

  const aplicarPrecioSugerido = () => {
    if (precioSugerido30 > 0) {
      setPrecioVenta(precioSugerido30.toFixed(2));
    }
  };

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      // Ensure the SKU and controlled fields are used
      formData.set("sku", sku);
      formData.set("categoria_id", selectedCategoria);
      formData.set("proveedor_id", selectedProveedor);
      formData.set("unidad_medida", unidadMedida);
      formData.set("precio_costo_usd", precioCosto);
      formData.set("precio_venta_usd", precioVenta);

      // Validación reactiva de unidades enteras
      if (esUnidadEntera(unidadMedida)) {
        const stockActVal = parseFloat(formData.get("stock_actual") as string);
        const stockMinVal = parseFloat(formData.get("stock_minimo") as string);
        if (mode === "crear" && !isNaN(stockActVal) && !Number.isInteger(stockActVal)) {
          toast.error("Para la unidad seleccionada, el stock inicial debe ser un número entero (sin decimales).");
          setLoading(false);
          return;
        }
        if (!isNaN(stockMinVal) && !Number.isInteger(stockMinVal)) {
          toast.error("Para la unidad seleccionada, el stock mínimo debe ser un número entero (sin decimales).");
          setLoading(false);
          return;
        }
      }

      let result;
      if (mode === "crear") {
        result = await crearProducto(formData);
      } else {
        result = await actualizarProducto(producto!.id, formData);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "crear"
          ? "Producto creado exitosamente"
          : "Producto actualizado exitosamente"
      );

      if (mode === "crear" && "id" in result) {
        router.push(`/dashboard/inventario/${result.id}`);
      } else {
        router.push(`/dashboard/inventario/${producto!.id}`);
      }
    } catch {
      toast.error("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* ── Información básica ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Información básica
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nombre">
              Nombre del producto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Ej: Tubo PVC 1/2 pulgada"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">
              SKU <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="sku"
                name="sku"
                placeholder="PLO-0001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerateSku}
                title="Generar SKU automáticamente (Categoría + Nombre)"
              >
                <Sparkles className="size-4 text-amber-500" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="codigo_barras">Código de barras</Label>
            <Input
              id="codigo_barras"
              name="codigo_barras"
              placeholder="Opcional"
              defaultValue={producto?.codigo_barras ?? ""}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              name="descripcion"
              placeholder="Descripción opcional del producto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* ── Clasificación ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Clasificación
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Categoría <span className="text-destructive">*</span>
            </Label>
            <Select
              name="categoria_id"
              value={selectedCategoria}
              onValueChange={(val) => setSelectedCategoria(val ?? "")}
              required
            >
              <SelectTrigger className="w-full h-10 text-sm">
                <SelectValue placeholder="Seleccionar categoría">
                  {categorias.find((c) => c.id === selectedCategoria)?.nombre ?? "Seleccionar categoría"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-full">
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select
              name="proveedor_id"
              value={selectedProveedor}
              onValueChange={(val) => setSelectedProveedor(val ?? "")}
            >
              <SelectTrigger className="w-full h-10 text-sm">
                <SelectValue placeholder="Sin proveedor">
                  {selectedProveedor
                    ? proveedores.find((p) => p.id === selectedProveedor)?.nombre ?? "Sin proveedor"
                    : "Sin proveedor"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-full">
                <SelectItem value="none">Sin proveedor</SelectItem>
                {proveedores.map((prov) => (
                  <SelectItem key={prov.id} value={prov.id}>
                    {prov.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Unidad de medida <span className="text-destructive">*</span>
            </Label>
            <Select
              name="unidad_medida"
              value={unidadMedida}
              onValueChange={(v) => setUnidadMedida(v as UnidadMedida)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar unidad" />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES_MEDIDA.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Precios ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Precios (USD)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="precio_costo_usd">
              Precio de costo <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="precio_costo_usd"
                name="precio_costo_usd"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={precioCosto}
                onChange={(e) => setPrecioCosto(e.target.value)}
                className="pl-7 font-medium"
                required
              />
            </div>
            {costoNum > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Sugerido (30% ganancia): <strong>{formatUSD(precioSugerido30)}</strong></span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={aplicarPrecioSugerido}
                  className="h-5 px-1.5 text-xs text-primary hover:underline"
                >
                  Usar sugerido
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="precio_venta_usd">
              Precio de venta <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="precio_venta_usd"
                name="precio_venta_usd"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                className="pl-7 font-medium"
                required
              />
            </div>
            {costoNum > 0 && ventaNum > 0 && (
              <div className="text-xs pt-1">
                <span className={gananciaUsd >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
                  Ganancia: {formatUSD(gananciaUsd)} ({porcentajeGanancia >= 0 ? `+${porcentajeGanancia}%` : `${porcentajeGanancia}%`})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stock ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stock
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "crear" && (
            <div className="space-y-2">
              <Label htmlFor="stock_actual">
                Stock inicial <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stock_actual"
                name="stock_actual"
                type="number"
                step={getStepPorUnidad(unidadMedida)}
                min="0"
                placeholder="0"
                defaultValue={0}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se registrará como movimiento de entrada inicial.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stock_minimo">
              Stock mínimo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="stock_minimo"
              name="stock_minimo"
              type="number"
              step={getStepPorUnidad(unidadMedida)}
              min="0"
              placeholder="0"
              defaultValue={producto?.stock_minimo ?? 0}
              required
            />
            <p className="text-xs text-muted-foreground">
              Dispara alerta cuando el stock actual sea igual o menor a este
              valor.
            </p>
          </div>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {mode === "crear" ? "Crear producto" : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
