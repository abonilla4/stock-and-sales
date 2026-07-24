"use client";

import { useOfflineNetwork } from "./offline-network-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, RefreshCw, AlertCircle, CloudUpload } from "lucide-react";

export function NetworkStatusBadge() {
  const {
    isOnline,
    isSimulatedOffline,
    setIsSimulatedOffline,
    pendingSyncCount,
    sincronizarAhora,
    isSyncing,
  } = useOfflineNetwork();

  return (
    <div className="flex items-center gap-3">
      {/* Switch para simular modo offline (solo en desarrollo/testing) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="hidden md:flex items-center gap-2 rounded-lg border bg-background/80 px-2.5 py-1 text-xs shadow-xs">
          <Label htmlFor="sim-offline-toggle" className="text-[11px] font-medium text-muted-foreground cursor-pointer">
            Simular Offline
          </Label>
          <Switch
            id="sim-offline-toggle"
            checked={isSimulatedOffline}
            onCheckedChange={setIsSimulatedOffline}
            className="scale-75"
          />
        </div>
      )}

      {/* Badge de Conexión de Red */}
      {isOnline ? (
        <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium text-xs py-1">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <Wifi className="size-3.5" />
          <span>Online</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium text-xs py-1">
          <WifiOff className="size-3.5" />
          <span>{isSimulatedOffline ? "Simulación Offline" : "Sin Conexión"}</span>
        </Badge>
      )}

      {/* Badge y Botón de Ventas Pendientes por Sincronizar */}
      {pendingSyncCount > 0 && (
        <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
          <Badge variant="destructive" className="gap-1 text-xs py-1 bg-amber-600 hover:bg-amber-700">
            <AlertCircle className="size-3.5" />
            <span>
              {pendingSyncCount} {pendingSyncCount === 1 ? "venta pendiente" : "ventas pendientes"}
            </span>
          </Badge>

          <Button
            variant="outline"
            size="xs"
            onClick={sincronizarAhora}
            disabled={isSyncing || !isOnline}
            className="h-7 text-xs gap-1 border-amber-500/40 hover:bg-amber-500/10 text-amber-900 dark:text-amber-300"
            title={!isOnline ? "Conéctate a internet para sincronizar" : "Forzar sincronización manual"}
          >
            <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
            <span>Sincronizar</span>
          </Button>
        </div>
      )}
    </div>
  );
}
