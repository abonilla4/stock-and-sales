"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Sparkles, Package, CornerDownLeft } from "lucide-react";
import type { Producto } from "@/lib/types/database";
import { usePosCart } from "./pos-cart-context";
import { buscarProductosPOS } from "@/app/dashboard/pos/actions";

interface PosSearchProps {
  productosIniciales: Producto[];
}

export function PosSearch({ productosIniciales }: PosSearchProps) {
  const { agregarProducto } = usePosCart();
  const [query, setQuery] = useState("");
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [buscando, setBuscando] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Escuchar teclas globales F2 para enfocar búsqueda, Esc para limpiar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2" || (e.key === "/" && document.activeElement?.tagName !== "INPUT")) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setQuery("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Búsqueda en tiempo real cuando cambia query
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await buscarProductosPOS(query);
        if (active) {
          setProductos(res);
          setSelectedIndex(0);
        }
      } finally {
        if (active) setBuscando(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelectProduct = (p: Producto) => {
    agregarProducto(p, 1);
    setQuery("");
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < productos.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && productos.length > 0) {
      e.preventDefault();
      const p = productos[selectedIndex] || productos[0];
      if (p) handleSelectProduct(p);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Buscador con indicador F2 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar por Nombre, SKU o Código de Barras... (Presiona F2 o /)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDownInput}
          className="pl-9 pr-16 h-11 text-base font-medium"
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <kbd className="hidden sm:inline-block pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            F2
          </kbd>
        </div>
      </div>

      {/* Resultados de búsqueda en cuadrícula */}
      <div className="flex-1 overflow-y-auto pr-1">
        {productos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {productos.map((p, index) => {
              const isSelected = index === selectedIndex && query.length > 0;
              const sinStock = p.stock_actual <= 0;
              const stockBajo = p.stock_actual <= p.stock_minimo;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className={`group relative flex flex-col justify-between rounded-lg border p-3.5 transition-all cursor-pointer select-none hover:border-primary hover:shadow-sm ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm line-clamp-2 leading-snug">
                        {p.nombre}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                        {p.sku}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{p.unidad_medida}</span>
                      {p.codigo_barras && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[11px]">{p.codigo_barras}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-2">
                    <div>
                      <span className="text-xs text-muted-foreground block">Precio</span>
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(p.precio_venta_usd).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Stock</span>
                        <span
                          className={`text-xs font-semibold ${
                            sinStock
                              ? "text-destructive"
                              : stockBajo
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                          }`}
                        >
                          {p.stock_actual} {p.unidad_medida}s
                        </span>
                      </div>

                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Plus className="size-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed text-center p-6">
            <Package className="size-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {buscando
                ? "Buscando en catálogo..."
                : query
                ? `No se encontraron productos coincidentes con "${query}"`
                : "No hay productos disponibles"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
