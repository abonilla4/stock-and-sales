"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import type { Producto } from "@/lib/types/database";

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
}

interface PosCartContextType {
  items: ItemCarrito[];
  descuentoUsd: number;
  tasaActiva: number;
  agregarProducto: (producto: Producto, cantidad?: number) => void;
  actualizarCantidad: (productoId: string, cantidad: number) => void;
  removerProducto: (productoId: string) => void;
  setDescuentoUsd: (descuento: number) => void;
  limpiarCarrito: () => void;
  subtotalUsd: number;
  totalUsd: number;
  subtotalBs: number;
  totalBs: number;
}

const PosCartContext = createContext<PosCartContextType | undefined>(undefined);

export function PosCartProvider({
  tasaInicial,
  children,
}: {
  tasaInicial: number;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [descuentoUsd, setDescuentoUsdState] = useState<number>(0);
  const [tasaActiva] = useState<number>(tasaInicial);

  const agregarProducto = (producto: Producto, cantidadAdicional: number = 1) => {
    setItems((prevItems) => {
      const index = prevItems.findIndex((i) => i.producto.id === producto.id);
      if (index >= 0) {
        const itemExistente = prevItems[index];
        const nuevaCantidad = itemExistente.cantidad + cantidadAdicional;
        const nuevoSubtotal = nuevaCantidad * itemExistente.precio_unitario_usd;
        const copia = [...prevItems];
        copia[index] = {
          ...itemExistente,
          cantidad: Number(nuevaCantidad.toFixed(2)),
          subtotal_usd: Number(nuevoSubtotal.toFixed(2)),
        };
        return copia;
      } else {
        const precioUnitario = producto.precio_venta_usd;
        const subtotal = cantidadAdicional * precioUnitario;
        return [
          ...prevItems,
          {
            producto,
            cantidad: Number(cantidadAdicional.toFixed(2)),
            precio_unitario_usd: Number(precioUnitario.toFixed(2)),
            subtotal_usd: Number(subtotal.toFixed(2)),
          },
        ];
      }
    });
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      removerProducto(productoId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.producto.id === productoId) {
          const subtotal = cantidad * item.precio_unitario_usd;
          return {
            ...item,
            cantidad: Number(cantidad.toFixed(2)),
            subtotal_usd: Number(subtotal.toFixed(2)),
          };
        }
        return item;
      })
    );
  };

  const removerProducto = (productoId: string) => {
    setItems((prevItems) => prevItems.filter((i) => i.producto.id !== productoId));
  };

  const setDescuentoUsd = (descuento: number) => {
    setDescuentoUsdState(Math.max(0, Number(descuento.toFixed(2))));
  };

  const limpiarCarrito = () => {
    setItems([]);
    setDescuentoUsdState(0);
  };

  const subtotalUsd = useMemo(() => {
    const sum = items.reduce((acc, item) => acc + item.subtotal_usd, 0);
    return Number(sum.toFixed(2));
  }, [items]);

  const totalUsd = useMemo(() => {
    const total = Math.max(0, subtotalUsd - descuentoUsd);
    return Number(total.toFixed(2));
  }, [subtotalUsd, descuentoUsd]);

  const subtotalBs = useMemo(() => {
    return Number((subtotalUsd * tasaActiva).toFixed(2));
  }, [subtotalUsd, tasaActiva]);

  const totalBs = useMemo(() => {
    return Number((totalUsd * tasaActiva).toFixed(2));
  }, [totalUsd, tasaActiva]);

  return (
    <PosCartContext.Provider
      value={{
        items,
        descuentoUsd,
        tasaActiva,
        agregarProducto,
        actualizarCantidad,
        removerProducto,
        setDescuentoUsd,
        limpiarCarrito,
        subtotalUsd,
        totalUsd,
        subtotalBs,
        totalBs,
      }}
    >
      {children}
    </PosCartContext.Provider>
  );
}

export function usePosCart() {
  const context = useContext(PosCartContext);
  if (!context) {
    throw new Error("usePosCart debe usarse dentro de un PosCartProvider");
  }
  return context;
}
