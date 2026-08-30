"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  UserPlus,
  ArrowLeft,
  DollarSign,
  Coins,
  CheckCircle2,
  Package,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { Producto, Cliente, MonedaPresupuesto } from "@/lib/types/database";
import { crearPresupuesto } from "@/app/dashboard/presupuestos/actions";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { toast } from "sonner";

interface NuevoPresupuestoClientProps {
  productosIniciales: Producto[];
  clientesIniciales: Cliente[];
  tasaActiva: number;
}

interface ItemCarritoPresupuesto {
  producto: Producto;
  cantidad: number;
}

export function NuevoPresupuestoClient({
  productosIniciales,
  clientesIniciales,
  tasaActiva,
}: NuevoPresupuestoClientProps) {
  const router = useRouter();

  // Estados de productos y búsqueda
  const [productos] = useState<Producto[]>(productosIniciales);
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales);
  const [busqueda, setBusqueda] = useState("");

  // Estado del presupuesto
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemCarritoPresupuesto[]>([]);
  const [descuentoUsd, setDescuentoUsd] = useState<number>(0);
  const [monedaMostrada, setMonedaMostrada] = useState<MonedaPresupuesto>("usd");
  const [notas, setNotas] = useState<string>("");
  const [guardando, setGuardando] = useState(false);

  // Modal para crear nuevo cliente en caliente
  const [clienteModalOpen, setClienteModalOpen] = useState(false);

  // Filtrado de productos en memoria
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q))
    );
  }, [productos, busqueda]);

  // Manejo de carrito
  const agregarProducto = (producto: Producto) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === producto.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          cantidad: next[idx].cantidad + 1,
        };
        return next;
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const modificarCantidad = (productoId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const nuevaCant = Math.max(1, item.cantidad + delta);
            return { ...item, cantidad: nuevaCant };
          }
          return item;
        })
    );
  };

  const establecerCantidad = (productoId: string, cant: number) => {
    if (isNaN(cant) || cant <= 0) return;
    setItems((prev) =>
      prev.map((item) =>
        item.producto.id === productoId ? { ...item, cantidad: cant } : item
      )
    );
  };

  const eliminarProducto = (productoId: string) => {
    setItems((prev) => prev.filter((i) => i.producto.id !== productoId));
  };

  // Cálculos totales
  const subtotalUsd = useMemo(() => {
    return items.reduce(
      (acc, item) => acc + item.cantidad * Number(item.producto.precio_venta_usd),
      0
    );
  }, [items]);

  const subtotalRedondeado = Math.round(subtotalUsd * 100) / 100;
  const descuentoValido = Math.min(subtotalRedondeado, Math.max(0, descuentoUsd || 0));
  const totalUsd = Math.max(0, Math.round((subtotalRedondeado - descuentoValido) * 100) / 100);
  const totalBsReferencial = Math.round(totalUsd * (tasaActiva || 1) * 100) / 100;

  const handleClienteCreado = (nuevoClienteId: string) => {
    setClienteSeleccionadoId(nuevoClienteId);
    router.refresh();
  };

  const handleGuardarPresupuesto = async () => {
    if (items.length === 0) {
      toast.error("Debes agregar al menos un producto para crear el presupuesto.");
      return;
    }

    setGuardando(true);
    try {
      const res = await crearPresupuesto({
        cliente_id: clienteSeleccionadoId,
        descuento_usd: descuentoValido,
        moneda_mostrada: monedaMostrada,
        notas: notas.trim() || null,
        items: items.map((i) => ({
          producto_id: i.producto.id,
          cantidad: i.cantidad,
        })),
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(`¡Presupuesto ${res.folio} creado exitosamente!`);
      router.push("/dashboard/presupuestos");
      router.refresh();
    } catch (err: any) {
      toast.error("Error al guardar presupuesto: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de cabecera */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/presupuestos"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-4 mr-1" /> Volver
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="size-5 text-primary" /> Nuevo Presupuesto
            </h1>
            <p className="text-xs text-muted-foreground">
              Cotización informativa · No reserva ni descuenta inventario
            </p>
          </div>
        </div>

        {/* Tasa activa referencial */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-mono">
          <span className="text-muted-foreground">Tasa activa:</span>
          <span className="font-bold text-foreground">
            Bs. {tasaActiva.toFixed(2)} / USD
          </span>
        </div>
      </div>

      {/* Cuadrícula de 2 columnas (Productos y Panel de Cotización) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna izquierda: Catálogo de Productos (7 columnas) */}
        <div className="space-y-3 lg:col-span-7">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
            {productosFiltrados.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground text-xs">
                No se encontraron productos que coincidan con la búsqueda.
              </div>
            ) : (
              productosFiltrados.map((p) => {
                const enCarrito = items.find((i) => i.producto.id === p.id);
                return (
                  <Card
                    key={p.id}
                    className={`transition-all hover:border-primary/50 cursor-pointer overflow-hidden ${
                      enCarrito ? "border-primary/60 bg-primary/5" : ""
                    }`}
                    onClick={() => agregarProducto(p)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <p className="font-bold text-xs line-clamp-1 text-foreground">
                            {p.nombre}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            SKU: {p.sku}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                          Stock: {p.stock_actual} {p.unidad_medida}
                        </Badge>
                      </div>

                      <div className="flex justify-between items-end pt-1">
                        <div>
                          <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                            ${Number(p.precio_venta_usd).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Bs. {(Number(p.precio_venta_usd) * (tasaActiva || 1)).toFixed(2)}
                          </p>
                        </div>

                        <Button
                          size="xs"
                          variant={enCarrito ? "default" : "outline"}
                          className="h-7 text-xs px-2.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            agregarProducto(p);
                          }}
                        >
                          <Plus className="size-3.5 mr-1" />
                          {enCarrito ? `${enCarrito.cantidad}` : "Agregar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Columna derecha: Resumen del Presupuesto (5 columnas) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border bg-card p-4 space-y-4 shadow-xs">
            {/* Selección de Cliente */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Cliente Asignado
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 text-xs text-primary"
                  onClick={() => setClienteModalOpen(true)}
                >
                  <UserPlus className="size-3 mr-1" /> + Nuevo Cliente
                </Button>
              </div>

              <select
                value={clienteSeleccionadoId ?? ""}
                onChange={(e) => setClienteSeleccionadoId(e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="">Cliente genérico / Contado</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.identificacion ? `(${c.identificacion})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <Separator />

            {/* Lista de Ítems en el Presupuesto */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Productos Cotizados ({items.length})
                </Label>
                {items.length > 0 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 text-xs text-rose-500 hover:text-rose-600"
                    onClick={() => setItems([])}
                  >
                    Vaciar lista
                  </Button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Package className="mx-auto size-8 opacity-30 mb-2" />
                  Selecciona productos del catálogo a la izquierda para armar la cotización.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-border/50">
                  {items.map((item) => (
                    <div
                      key={item.producto.id}
                      className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {item.producto.nombre}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          ${Number(item.producto.precio_venta_usd).toFixed(2)} c/u
                        </p>
                      </div>

                      {/* Controles de cantidad */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-6"
                          onClick={() => modificarCantidad(item.producto.id, -1)}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) =>
                            establecerCantidad(
                              item.producto.id,
                              parseFloat(e.target.value) || 1
                            )
                          }
                          className="h-6 w-12 text-center text-xs p-1 font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-6"
                          onClick={() => modificarCantidad(item.producto.id, 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>

                      {/* Subtotal y Eliminar */}
                      <div className="text-right font-mono font-bold w-16">
                        ${(item.cantidad * Number(item.producto.precio_venta_usd)).toFixed(2)}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-rose-500"
                        onClick={() => eliminarProducto(item.producto.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Opciones adicionales: Descuento, Moneda mostrada, Notas */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">
                    Descuento ($ USD)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={descuentoUsd || ""}
                    onChange={(e) => setDescuentoUsd(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">
                    Moneda para Imprimir
                  </Label>
                  <div className="flex rounded-md border bg-muted/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => setMonedaMostrada("usd")}
                      className={`flex-1 rounded text-xs py-1 font-medium transition-all ${
                        monedaMostrada === "usd"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonedaMostrada("bs")}
                      className={`flex-1 rounded text-xs py-1 font-medium transition-all ${
                        monedaMostrada === "bs"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      Bs.
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Notas / Condiciones de Validez
                </Label>
                <Textarea
                  placeholder="Ej: Precios sujetos a cambio, tiempo estimado de entrega 3 días..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Totales Resumen */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>${subtotalRedondeado.toFixed(2)}</span>
              </div>
              {descuentoValido > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Descuento:</span>
                  <span>-${descuentoValido.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-sans font-bold text-sm uppercase text-foreground">
                  Total Cotizado:
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ${totalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-muted-foreground text-[11px]">
                <span className="font-sans">Referencial en Bs (Tasa {tasaActiva.toFixed(2)}):</span>
                <span className="font-bold text-foreground">
                  Bs. {totalBsReferencial.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Nota legal referencial */}
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-[10px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Vigencia estándar: 7 días continuos. Los precios se revalidarán en vivo al momento de la facturación.
              </span>
            </div>

            {/* Botón de Guardar Presupuesto */}
            <Button
              type="button"
              className="w-full gap-2 font-bold"
              onClick={handleGuardarPresupuesto}
              disabled={guardando || items.length === 0}
            >
              <CheckCircle2 className="size-4" />
              {guardando ? "Guardando presupuesto..." : "Crear Presupuesto"}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal para crear cliente en caliente */}
      <ClienteFormDialog
        open={clienteModalOpen}
        onOpenChange={setClienteModalOpen}
        onClienteCreado={handleClienteCreado}
      />
    </div>
  );
}
