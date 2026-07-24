// =============================================================
// Utilidades de formateo numérico y de moneda — Stock&Sales
// Estándar regional es-VE: "." para separador de miles, "," para decimales
// =============================================================

/**
 * Formatea un número o string a formato decimal con separador de miles '.' y decimal ','
 * Ejemplo: 1234567.89 -> "1.234.567,89"
 */
export function formatNumero(
  val: number | string | null | undefined,
  decimals: number = 2
): string {
  if (val === null || val === undefined || val === "") return "0," + "0".repeat(decimals);
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "0," + "0".repeat(decimals);

  const parts = num.toFixed(decimals).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
}

/**
 * Formatea un monto en dólares (USD)
 * Ejemplo: 1234.5 -> "$1.234,50"
 */
export function formatUSD(
  val: number | string | null | undefined,
  decimals: number = 2
): string {
  return `$${formatNumero(val, decimals)}`;
}

/**
 * Formatea un monto en bolívares (Bs)
 * Ejemplo: 1234.5 -> "Bs. 1.234,50"
 */
export function formatBs(
  val: number | string | null | undefined,
  decimals: number = 2
): string {
  return `Bs. ${formatNumero(val, decimals)}`;
}
