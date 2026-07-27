/**
 * Retorna los rangos en formato ISO UTC para el inicio y fin del día en zona horaria de Venezuela (America/Caracas, UTC-4).
 * @param offsetDias Offset de días relativo a hoy (0 = hoy, -1 = ayer)
 */
export function getRangosDiaVenezuela(offsetDias: number = 0): { inicioUtc: string; finUtc: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  // UTC-4 significa que las 00:00:00 en VZLA corresponden a las 04:00:00 UTC del mismo día
  const inicioUtc = new Date(Date.UTC(year, month, day + offsetDias, 4, 0, 0, 0)).toISOString();
  // Y las 23:59:59.999 VZLA corresponden a las 03:59:59.999 UTC del día siguiente
  const finUtc = new Date(Date.UTC(year, month, day + offsetDias + 1, 3, 59, 59, 999)).toISOString();

  return { inicioUtc, finUtc };
}
