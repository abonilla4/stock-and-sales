import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TasaAlertaBannerProps {
  tasaActiva: number | null;
  fechaTasa: string | null;
  horasTranscurridas: number | null;
  sinTasa?: boolean;
}

export function TasaAlertaBanner({
  tasaActiva,
  fechaTasa,
  horasTranscurridas,
  sinTasa = false,
}: TasaAlertaBannerProps) {
  if (!sinTasa && (horasTranscurridas === null || horasTranscurridas < 24)) {
    return null; // Tasa al día (<24h)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <h4 className="font-semibold text-sm">
            {sinTasa
              ? "Tasa de cambio no configurada"
              : `Tasa de cambio desactualizada (${Math.floor(horasTranscurridas ?? 24)}h sin actualizar)`}
          </h4>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/80">
            {sinTasa
              ? "Para operar en el punto de venta (POS) debes registrar la tasa de cambio en bolívares (Bs / USD)."
              : `La tasa activa actual (${tasaActiva?.toFixed(2)} Bs/USD) fue registrada hace más de 24 horas (${fechaTasa ? new Date(fechaTasa).toLocaleString("es-VE") : ""}).`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-900"
          render={
            <Link href="/dashboard/configuracion/tasa-cambio" />
          }
        >
          <Clock className="size-3.5" />
          Actualizar tasa
        </Button>
      </div>
    </div>
  );
}
