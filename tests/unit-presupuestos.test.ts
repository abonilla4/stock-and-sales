import fs from "fs";
import path from "path";
import {
  crearPresupuestoSchema,
  confirmarVentaSchema,
} from "../src/lib/schemas/actions-schemas";
import {
  calcularSubtotalUsd,
  calcularTotalUsd,
  convertirABolivares,
} from "../src/lib/calculations";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FAILED: ${testName}`);
    totalFailed++;
  }
}

async function runTestSuite() {
  console.log("================================================================");
  console.log("SUITE DE TESTS: MÓDULO DE PRESUPUESTOS (NÚCLEO)");
  console.log("================================================================\n");

  // -------------------------------------------------------------
  // 1. TESTS DE ESQUEMAS ZOD
  // -------------------------------------------------------------
  console.log("--- 1. VALIDACIÓN DE ESQUEMAS ZOD ---");

  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  // Presupuesto válido con cliente
  const resValido = crearPresupuestoSchema.safeParse({
    cliente_id: validUuid,
    descuento_usd: 5,
    moneda_mostrada: "usd",
    notas: "Válido por 7 días",
    items: [
      { producto_id: validUuid, cantidad: 2 },
    ],
  });
  assert(resValido.success, "Esquema válido con cliente registrado");

  // Presupuesto válido con cliente NULL (genérico)
  const resGenerico = crearPresupuestoSchema.safeParse({
    cliente_id: null,
    descuento_usd: 0,
    moneda_mostrada: "bs",
    items: [
      { producto_id: validUuid, cantidad: 1 },
    ],
  });
  assert(resGenerico.success, "Esquema válido con cliente genérico (NULL)");

  // Rechazo de descuento negativo
  const resDescuentoNegativo = crearPresupuestoSchema.safeParse({
    cliente_id: null,
    descuento_usd: -10,
    items: [
      { producto_id: validUuid, cantidad: 1 },
    ],
  });
  assert(!resDescuentoNegativo.success, "Rechazo de descuento negativo");

  // Rechazo de lista de ítems vacía
  const resItemsVacio = crearPresupuestoSchema.safeParse({
    cliente_id: null,
    items: [],
  });
  assert(!resItemsVacio.success, "Rechazo de presupuesto sin productos");

  // Rechazo de cantidad menor o igual a cero
  const resCantidadCero = crearPresupuestoSchema.safeParse({
    cliente_id: null,
    items: [
      { producto_id: validUuid, cantidad: 0 },
    ],
  });
  assert(!resCantidadCero.success, "Rechazo de ítem con cantidad 0");

  // Confirmar que confirmarVentaSchema acepta presupuesto_id opcional
  const resVentaConPresupuesto = confirmarVentaSchema.safeParse({
    cliente_id: validUuid,
    subtotal_usd: 100,
    descuento_usd: 10,
    total_usd: 90,
    tasa_cambio_aplicada: 45.0,
    total_bs: 4050,
    metodo_pago: "efectivo_usd",
    items: [
      { producto_id: validUuid, cantidad: 1, precio_unitario_usd: 100, subtotal_usd: 100 },
    ],
    presupuesto_id: validUuid,
  });
  assert(resVentaConPresupuesto.success, "confirmarVentaSchema acepta presupuesto_id UUID");

  // -------------------------------------------------------------
  // 2. CÁLCULO DE TOTALES Y EQUIVALENTE REFERENCIAL EN BS
  // -------------------------------------------------------------
  console.log("\n--- 2. CÁLCULOS DE COTIZACIÓN Y CONVERSIÓN REFERENCIAL ---");

  const itemsCotizacion = [
    { cantidad: 4, precio_unitario_usd: 15.00 }, // 60.00
    { cantidad: 2.5, precio_unitario_usd: 20.00 }, // 50.00
  ];
  const subtotal = calcularSubtotalUsd(itemsCotizacion);
  assert(subtotal === 110.00, "Subtotal exacto de cotización ($110.00 USD)");

  const totalConDescuento = calcularTotalUsd(subtotal, 10.00);
  assert(totalConDescuento === 100.00, "Total cotizado con descuento ($100.00 USD)");

  const tasaActiva = 43.50;
  const totalBsReferencial = convertirABolivares(totalConDescuento, tasaActiva);
  assert(totalBsReferencial === 4350.00, "Monto referencial en Bolívares a tasa 43.50 (Bs. 4,350.00)");

  // -------------------------------------------------------------
  // 3. EVALUACIÓN DINÁMICA DE VENCIMIENTO
  // -------------------------------------------------------------
  console.log("\n--- 3. LÓGICA DINÁMICA DE VENCIMIENTO ---");

  const nowMs = Date.now();
  const fechaFutura = new Date(nowMs + 5 * 24 * 60 * 60 * 1000).toISOString(); // +5 días
  const fechaPasada = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString(); // -2 días

  const esVigenteActivo = (estado: string, vigencia: string) =>
    estado === "vigente" && new Date(vigencia).getTime() >= nowMs;

  const esVencidoDinamico = (estado: string, vigencia: string) =>
    estado === "vigente" && new Date(vigencia).getTime() < nowMs;

  assert(esVigenteActivo("vigente", fechaFutura), "Presupuesto vigente con fecha futura");
  assert(esVencidoDinamico("vigente", fechaPasada), "Presupuesto calculado como vencido dinámicamente");
  assert(!esVencidoDinamico("convertido", fechaPasada), "Presupuesto ya convertido no se marca como vencido");
  assert(!esVencidoDinamico("cancelado", fechaPasada), "Presupuesto cancelado no se marca como vencido");

  // -------------------------------------------------------------
  // 4. VERIFICACIÓN DEL ARCHIVO DE MIGRACIÓN 00023
  // -------------------------------------------------------------
  console.log("\n--- 4. INTEGRIDAD DE LA MIGRACIÓN 00023 ---");

  const migrationPath = path.resolve(__dirname, "../supabase/migrations/00023_modulo_presupuestos.sql");
  const migrationContent = fs.readFileSync(migrationPath, "utf-8");

  assert(migrationContent.includes("CREATE TYPE public.moneda_presupuesto"), "Migración crea ENUM moneda_presupuesto");
  assert(migrationContent.includes("CREATE TYPE public.estado_presupuesto"), "Migración crea ENUM estado_presupuesto");
  assert(migrationContent.includes("CREATE SEQUENCE IF NOT EXISTS public.presupuestos_folio_seq"), "Migración crea secuencia de folios");
  assert(migrationContent.includes("CREATE TABLE IF NOT EXISTS public.presupuestos"), "Migración crea tabla presupuestos");
  assert(migrationContent.includes("CREATE TABLE IF NOT EXISTS public.detalle_presupuesto"), "Migración crea tabla detalle_presupuesto");
  assert(migrationContent.includes("REVOKE UPDATE ON public.presupuestos FROM authenticated"), "Migración aplica candado estructural REVOKE UPDATE");
  assert(migrationContent.includes("CREATE OR REPLACE FUNCTION public.cancelar_presupuesto_rpc"), "Migración crea RPC cancelar_presupuesto_rpc");
  assert(migrationContent.includes("p_presupuesto_id          uuid DEFAULT NULL"), "Migración extiende procesar_venta_transaccion con p_presupuesto_id");
  assert(migrationContent.includes("FOR UPDATE"), "Migración incluye bloqueo FOR UPDATE para concurrencia");

  console.log("\n================================================================");
  console.log(`RESUMEN DE PRUEBAS: ${totalPassed} PASADAS | ${totalFailed} FALLADAS`);
  console.log("================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTestSuite();
