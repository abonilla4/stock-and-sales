"use client";

import { useState } from "react";
import { usePosCart } from "./pos-cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, AlertTriangle, Plus, Minus, CreditCard, Sparkles } from "lucide-react";
import { PosCheckoutDialog } from "./pos-checkout-dialog";
import { PosReceiptDialog, type ReciboVentaData } from "./pos-receipt-dialog";
import type { Cliente } from "@/lib/types/database";

interface PosCartProps {
  clientes: Cliente[];
  isAdmin: boolean;
}

export function PosCart({ clientes, isAdmin }: PosCartProps) {
  const {
    items,
    descuentoUsd,
    tasaActiva,
    actualizarCantidad,
    removerProducto,
    setDescuentoUsd,
    limpiarCarrito,
    subtotalUsd,
    totalUsd,
    subtotalBs,
    totalBs,
  } = usePosCart();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reciboData, setReciboData] = useState<ReciboVentaData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Verificar si hay algún producto con cantidad solicitada superior al stock disponible
  const itemsConStockInsuficiente = items.filter(
    (item) => item.cantidad > item.producto.stock_actual
  );
  const tieneStockInsuficiente = itemsConStockInsuficiente.length > 0;

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card shadow-sm">
      {/* Header del carrito */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Carrito de Venta</h3>
          <Badge variant="secondary" className="ml-1 font-mono text-xs">
            {items.length} {items.length === 1 ? "ítem" : "ítems"}
          </Badge>
        </div>

        {items.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={limpiarCarrito}
            className="text-destructive hover:bg-destructive/10 text-xs"
          >
            <Trash2 className="mr-1 size-3" /> Vaciar
          </Button>
        )}
      </div>

      {/* Lista de ítems en carrito */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const stockExcedido = item.cantidad > item.producto.stock_actual;

            return (
              <div
                key={item.producto.id}
                className={`rounded-lg border p-3 transition-colors ${
                  stockExcedido
                    ? "border-amber-400/80 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="font-medium text-sm leading-snug">
                      {item.producto.nombre}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px]">{item.producto.sku}</span>
                      <span>•</span>
                      <span className="capitalize">{item.producto.unidad_medida}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removerProducto(item.producto.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Controles de cantidad y precio */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center border rounded-md bg-background">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        actualizarCantidad(
                          item.producto.id,
                          Number((item.cantidad - 1).toFixed(2))
                        )
                      }
                      className="size-7 rounded-r-none"
                    >
                      <Minus className="size-3" />
                    </Button>

                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.cantidad}
                      onChange={(e) =>
                        actualizarCantidad(
                          item.producto.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-7 w-16 text-center text-xs border-0 focus-visible:ring-0 px-0 font-medium"
                    />

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        actualizarCantidad(
                          item.producto.id,
                          Number((item.cantidad + 1).toFixed(2))
                        )
                      }
                      className="size-7 rounded-l-none"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">
                      ${item.precio_unitario_usd.toFixed(2)} c/u
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      ${item.subtotal_usd.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Advertencia de stock insuficiente */}
                {stockExcedido && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>
                      Stock disponible: {item.producto.stock_actual} (Requiere autorización)
                    </span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
            <ShoppingCart className="size-12 stroke-[1.25] text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium">El carrito está vacío</p>
            <p className="text-xs text-muted-foreground mt-1">
              Busca o escanea un producto a la izquierda para agregarlo a la venta.
            </p>
          </div>
        )}
      </div>

      {/* Footer del carrito: Totales Duales (USD & Bs) */}
      <div className="border-t p-4 space-y-3 bg-muted/20 rounded-b-xl">
        {/* Descuento global */}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="descuento" className="text-xs text-muted-foreground">
            Descuento (USD)
          </Label>
          <div className="relative w-28">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              id="descuento"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={descuentoUsd || ""}
              onChange={(e) => setDescuentoUsd(parseFloat(e.target.value) || 0)}
              className="h-7 text-xs pl-6 text-right font-medium"
              disabled={items.length === 0}
            />
          </div>
        </div>

        <Separator />

        {/* Resumen de totales duales */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Subtotal</span>
            <span>${subtotalUsd.toFixed(2)} USD</span>
          </div>

          {descuentoUsd > 0 && (
            <div className="flex justify-between text-emerald-600 text-xs">
              <span>Descuento</span>
              <span>-${descuentoUsd.toFixed(2)} USD</span>
            </div>
          )}

          <div className="flex items-baseline justify-between pt-1">
            <span className="font-bold text-base">TOTAL A PAGAR</span>
            <div className="text-right">
              <span className="text-xl font-extrabold text-primary block leading-none">
                ${totalUsd.toFixed(2)} <span className="text-xs font-normal">USD</span>
              </span>
              <span className="text-xs font-semibold text-muted-foreground block mt-0.5">
                Bs. {totalBs.toFixed(2)} <span className="text-[10px] font-normal">({tasaActiva.toFixed(2)} Bs/$)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Advertencia general de stock insuficiente */}
        {tieneStockInsuficiente && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>
              Hay ítems sin stock suficiente. La confirmación requerirá clave de Administrador.
            </span>
          </div>
        )}

        {/* Botón de cobrar */}
        <Button
          size="lg"
          className="w-full h-12 text-base font-semibold shadow-md"
          disabled={items.length === 0 || totalUsd <= 0}
          onClick={() => setCheckoutOpen(true)}
        >
          <CreditCard className="mr-2 size-5" /> Cobrar (${totalUsd.toFixed(2)})
        </Button>
      </div>

      {/* Modal de Cierre de Venta (Checkout) */}
      {checkoutOpen && (
        <PosCheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          clientes={clientes}
          isAdmin={isAdmin}
          tieneStockInsuficiente={tieneStockInsuficiente}
          onVentaExitosa={(recibo) => {
            setReciboData(recibo);
            setReceiptOpen(true);
          }}
        />
      )}

      {/* Modal de Recibo post-confirmación */}
      {receiptOpen && (
        <PosReceiptDialog
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          recibo={reciboData}
          onNuevaVenta={limpiarCarrito}
        />
      )}
    </div>
  );
}
