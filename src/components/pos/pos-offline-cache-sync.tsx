"use client";

import { useEffect } from "react";
import type { Producto, Cliente } from "@/lib/types/database";
import {
  cachearProductosLocales,
  cachearClientesLocales,
  cachearTasaActivaLocal,
} from "@/lib/offline/sync-cache";

interface PosOfflineCacheSyncProps {
  productos: Producto[];
  clientes: Cliente[];
  tasaActivaData?: { tasa: number; fecha?: string | null } | null;
}

export function PosOfflineCacheSync({
  productos,
  clientes,
  tasaActivaData,
}: PosOfflineCacheSyncProps) {
  useEffect(() => {
    // Cuando el cliente carga o cambia la data del servidor online,
    // guardamos en la base de datos IndexedDB local para uso offline
    if (productos && productos.length > 0) {
      cachearProductosLocales(productos);
    }
    if (clientes && clientes.length > 0) {
      cachearClientesLocales(clientes);
    }
    if (tasaActivaData && tasaActivaData.tasa) {
      cachearTasaActivaLocal(tasaActivaData);
    }
  }, [productos, clientes, tasaActivaData]);

  return null;
}
