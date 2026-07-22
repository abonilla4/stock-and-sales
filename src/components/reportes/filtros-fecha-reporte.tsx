"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Filter } from "lucide-react";

export type PresetFecha = "hoy" | "7d" | "30d" | "mes" | "custom";

interface FiltrosFechaReporteProps {
  fechaInicio: string;
  fechaFin: string;
  onCambiarRango: (inicio: string, fin: string) => void;
}

export function FiltrosFechaReporte({
  fechaInicio,
  fechaFin,
  onCambiarRango,
}: FiltrosFechaReporteProps) {
  const [preset, setPreset] = useState<PresetFecha>("30d");
  const [customInicio, setCustomInicio] = useState(fechaInicio);
  const [customFin, setCustomFin] = useState(fechaFin);

  const aplicarPreset = (p: PresetFecha) => {
    setPreset(p);
    const hoy = new Date();
    let inicio = new Date();
    let fin = new Date();

    if (p === "hoy") {
      inicio = hoy;
      fin = hoy;
    } else if (p === "7d") {
      inicio = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
      fin = hoy;
    } else if (p === "30d") {
      inicio = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
      fin = hoy;
    } else if (p === "mes") {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = hoy;
    } else if (p === "custom") {
      return;
    }

    const isoInicio = inicio.toISOString().split("T")[0];
    const isoFin = fin.toISOString().split("T")[0];

    setCustomInicio(isoInicio);
    setCustomFin(isoFin);
    onCambiarRango(isoInicio, isoFin);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInicio && customFin) {
      setPreset("custom");
      onCambiarRango(customInicio, customFin);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">Período de reporte:</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Presets rápidos */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button
            type="button"
            variant={preset === "hoy" ? "default" : "ghost"}
            size="xs"
            onClick={() => aplicarPreset("hoy")}
          >
            Hoy
          </Button>
          <Button
            type="button"
            variant={preset === "7d" ? "default" : "ghost"}
            size="xs"
            onClick={() => aplicarPreset("7d")}
          >
            7 Días
          </Button>
          <Button
            type="button"
            variant={preset === "30d" ? "default" : "ghost"}
            size="xs"
            onClick={() => aplicarPreset("30d")}
          >
            30 Días
          </Button>
          <Button
            type="button"
            variant={preset === "mes" ? "default" : "ghost"}
            size="xs"
            onClick={() => aplicarPreset("mes")}
          >
            Este mes
          </Button>
        </div>

        {/* Inputs de fechas personalizadas */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <Input
            type="date"
            value={customInicio}
            onChange={(e) => setCustomInicio(e.target.value)}
            className="h-8 text-xs w-32 font-mono"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="date"
            value={customFin}
            onChange={(e) => setCustomFin(e.target.value)}
            className="h-8 text-xs w-32 font-mono"
          />
          <Button type="submit" size="xs" variant="secondary">
            <Filter className="mr-1 size-3" /> Filtrar
          </Button>
        </form>
      </div>
    </div>
  );
}
