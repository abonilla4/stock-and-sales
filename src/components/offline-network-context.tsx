"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { obtenerConteoPendientesSync, sincronizarColaVentas } from "@/lib/offline/sales-manager";
import { toast } from "sonner";

interface OfflineNetworkContextType {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  setIsSimulatedOffline: (value: boolean) => void;
  pendingSyncCount: number;
  refreshPendingCount: () => Promise<void>;
  sincronizarAhora: () => Promise<void>;
  isSyncing: boolean;
}

const OfflineNetworkContext = createContext<OfflineNetworkContextType>({
  isOnline: true,
  isSimulatedOffline: false,
  setIsSimulatedOffline: () => {},
  pendingSyncCount: 0,
  refreshPendingCount: async () => {},
  sincronizarAhora: async () => {},
  isSyncing: false,
});

export function OfflineNetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await obtenerConteoPendientesSync();
    setPendingSyncCount(count);
  }, []);

  const sincronizarAhora = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await sincronizarColaVentas();
      if (res.procesadas > 0) {
        if (res.exitosas > 0) {
          toast.success(`Sincronización completada: ${res.exitosas} venta(s) enviada(s) con éxito.`);
        }
        if (res.errores > 0) {
          toast.warning(`Atención: ${res.errores} venta(s) requirieron revisión o fallo de red.`);
        }
      }
      await refreshPendingCount();
    } catch {
      toast.error("Error inesperado durante la sincronización.");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Conexión a internet restaurada. Sincronizando datos pendientes...");
      sincronizarAhora();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Modo sin conexión detectado. Las ventas se guardarán localmente.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Intervalo de verificación cada 15 segundos si hay pendientes
    const interval = setInterval(() => {
      refreshPendingCount();
      if (navigator.onLine && !isSimulatedOffline) {
        obtenerConteoPendientesSync().then((cnt) => {
          if (cnt > 0) sincronizarAhora();
        });
      }
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, sincronizarAhora, isSimulatedOffline]);

  return (
    <OfflineNetworkContext.Provider
      value={{
        isOnline: isOnline && !isSimulatedOffline,
        isSimulatedOffline,
        setIsSimulatedOffline,
        pendingSyncCount,
        refreshPendingCount,
        sincronizarAhora,
        isSyncing,
      }}
    >
      {children}
    </OfflineNetworkContext.Provider>
  );
}

export function useOfflineNetwork() {
  return useContext(OfflineNetworkContext);
}
