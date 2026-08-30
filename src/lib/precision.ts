import type { UnidadMedida } from "@/lib/types/database";

/**
 * Unidades de medida discretas/no fraccionables que exigen cantidades enteras (sin decimales).
 */
export const UNIDADES_ENTERAS: readonly UnidadMedida[] = [
  "unidad",
  "par",
  "caja",
] as const;

/**
 * Determina si una unidad de medida es de tipo entero (no admite decimales).
 */
export function esUnidadEntera(unidad?: string | null): boolean {
  if (!unidad) return false;
  return (UNIDADES_ENTERAS as readonly string[]).includes(unidad.toLowerCase().trim());
}

/**
 * Valida si una cantidad numérica es válida según la unidad de medida:
 * - Si es unidad entera (ej: "unidad", "par", "caja"), debe ser un entero exacto (Number.isInteger).
 * - Si es unidad continua (ej: "metro", "kilo", "litro"), se permiten decimales.
 */
export function esCantidadValidaParaUnidad(
  cantidad: number,
  unidad?: string | null
): boolean {
  if (typeof cantidad !== "number" || isNaN(cantidad)) {
    return false;
  }
  if (esUnidadEntera(unidad)) {
    return Number.isInteger(cantidad);
  }
  return true;
}

/**
 * Retorna el valor para el atributo 'step' del input HTML según la unidad de medida:
 * - "1" para unidades enteras.
 * - "0.01" para unidades con decimales.
 */
export function getStepPorUnidad(unidad?: string | null): string {
  return esUnidadEntera(unidad) ? "1" : "0.01";
}
