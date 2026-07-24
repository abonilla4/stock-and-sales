/**
 * Funciones puras de cálculo financiero y matemático para Stock&Sales.
 * Garantizan precisión de 2 decimales y conversión exacta a Bolívares.
 */

export interface ItemCalculo {
  cantidad: number;
  precio_unitario_usd: number;
}

export function calcularSubtotalUsd(items: ItemCalculo[]): number {
  if (!items || items.length === 0) return 0;
  const sum = items.reduce((acc, item) => {
    const subtotal = Number(item.cantidad) * Number(item.precio_unitario_usd);
    return acc + subtotal;
  }, 0);
  return Number(sum.toFixed(2));
}

export function calcularTotalUsd(subtotalUsd: number, descuentoUsd: number): number {
  const sub = Math.max(0, Number(subtotalUsd));
  const desc = Math.max(0, Number(descuentoUsd));
  const total = Math.max(0, sub - desc);
  return Number(total.toFixed(2));
}

export function convertirABolivares(montoUsd: number, tasaCambio: number): number {
  const monto = Math.max(0, Number(montoUsd));
  const tasa = Math.max(0, Number(tasaCambio));
  return Number((monto * tasa).toFixed(2));
}

export function calcularMargenGanancia(ingresosUsd: number, costoVentasUsd: number) {
  const ingresos = Number(ingresosUsd.toFixed(2));
  const costos = Number(costoVentasUsd.toFixed(2));
  const gananciaBruta = Number(Math.max(0, ingresos - costos).toFixed(2));
  const porcentajeMargen = ingresos > 0 ? Number(((gananciaBruta / ingresos) * 100).toFixed(2)) : 0;

  return {
    ingresosUsd: ingresos,
    costosUsd: costos,
    gananciaBrutaUsd: gananciaBruta,
    porcentajeMargen,
  };
}
