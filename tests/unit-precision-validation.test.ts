import fs from "fs";
import path from "path";
import {
  esUnidadEntera,
  esCantidadValidaParaUnidad,
  getStepPorUnidad,
} from "../src/lib/precision";
import {
  crearProductoSchema,
  actualizarProductoSchema,
} from "../src/lib/schemas/actions-schemas";

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

async function runPrecisionTests() {
  console.log("================================================================");
  console.log("SUITE DE TESTS: VALIDACIÓN DE PRECISIÓN Y UNIDADES ENTERAS");
  console.log("================================================================\n");

  // -------------------------------------------------------------
  // 1. HELPERS DE PRECISIÓN
  // -------------------------------------------------------------
  console.log("--- 1. HELPERS DE PRECISIÓN (src/lib/precision.ts) ---");

  assert(esUnidadEntera("unidad") === true, "esUnidadEntera('unidad') es true");
  assert(esUnidadEntera("par") === true, "esUnidadEntera('par') es true");
  assert(esUnidadEntera("caja") === true, "esUnidadEntera('caja') es true");
  assert(esUnidadEntera("metro") === false, "esUnidadEntera('metro') es false");
  assert(esUnidadEntera("kilo") === false, "esUnidadEntera('kilo') es false");
  assert(esUnidadEntera("litro") === false, "esUnidadEntera('litro') es false");

  assert(esCantidadValidaParaUnidad(5, "unidad") === true, "5 unidades es válido");
  assert(esCantidadValidaParaUnidad(5.5, "unidad") === false, "5.5 unidades es inválido");
  assert(esCantidadValidaParaUnidad(5.5, "metro") === true, "5.5 metros es válido");

  assert(getStepPorUnidad("unidad") === "1", "getStepPorUnidad('unidad') retorna '1'");
  assert(getStepPorUnidad("par") === "1", "getStepPorUnidad('par') retorna '1'");
  assert(getStepPorUnidad("metro") === "0.01", "getStepPorUnidad('metro') retorna '0.01'");

  // -------------------------------------------------------------
  // 2. ESQUEMAS ZOD (crearProductoSchema & actualizarProductoSchema)
  // -------------------------------------------------------------
  console.log("\n--- 2. ESQUEMAS ZOD PARA PRODUCTOS ---");

  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  // Caso: Producto con unidad "unidad" y stock decimal debe fallar
  const prodInvalidoUnidad = {
    sku: "TEST-DECIMAL-1",
    nombre: "Tubo PVC",
    categoria_id: validUuid,
    unidad_medida: "unidad",
    precio_costo_usd: 10,
    precio_venta_usd: 15,
    stock_actual: 5.5,
    stock_minimo: 2,
  };
  const resInvalido = crearProductoSchema.safeParse(prodInvalidoUnidad);
  assert(
    !resInvalido.success &&
      resInvalido.error.issues.some((i) => i.path.includes("stock_actual")),
    "crearProductoSchema rechaza stock_actual decimal (5.5) para 'unidad'"
  );

  const prodInvalidoStockMin = {
    sku: "TEST-DECIMAL-2",
    nombre: "Tubo PVC",
    categoria_id: validUuid,
    unidad_medida: "par",
    precio_costo_usd: 10,
    precio_venta_usd: 15,
    stock_actual: 5,
    stock_minimo: 1.5,
  };
  const resInvalidoMin = crearProductoSchema.safeParse(prodInvalidoStockMin);
  assert(
    !resInvalidoMin.success &&
      resInvalidoMin.error.issues.some((i) => i.path.includes("stock_minimo")),
    "crearProductoSchema rechaza stock_minimo decimal (1.5) para 'par'"
  );

  // Caso: Producto con unidad "metro" y stock decimal debe pasar
  const prodValidoMetro = {
    sku: "TEST-METRO-1",
    nombre: "Cable Electrico",
    categoria_id: validUuid,
    unidad_medida: "metro",
    precio_costo_usd: 1.25,
    precio_venta_usd: 2.5,
    stock_actual: 12.75,
    stock_minimo: 5.5,
  };
  const resValidoMetro = crearProductoSchema.safeParse(prodValidoMetro);
  assert(resValidoMetro.success, "crearProductoSchema acepta stock decimal (12.75) para 'metro'");

  // Caso: Actualizar producto rechazando decimales en stock_minimo para 'unidad'
  const actInvalido = {
    sku: "TEST-ACT-1",
    nombre: "Bombillo LED",
    categoria_id: validUuid,
    unidad_medida: "unidad",
    precio_costo_usd: 2,
    precio_venta_usd: 4,
    stock_minimo: 3.25,
  };
  const resActInvalido = actualizarProductoSchema.safeParse(actInvalido);
  assert(
    !resActInvalido.success &&
      resActInvalido.error.issues.some((i) => i.path.includes("stock_minimo")),
    "actualizarProductoSchema rechaza stock_minimo decimal (3.25) para 'unidad'"
  );

  // -------------------------------------------------------------
  // 3. INTEGRIDAD DE LA MIGRACIÓN 00024 (CHECK CONSTRAINT & RPCs)
  // -------------------------------------------------------------
  console.log("\n--- 3. INTEGRIDAD DE LA MIGRACIÓN 00024 ---");

  const migrationPath = path.resolve(__dirname, "../supabase/migrations/00024_check_stock_entero_y_rpcs.sql");
  const migrationContent = fs.readFileSync(migrationPath, "utf-8");

  assert(
    migrationContent.includes("CONSTRAINT check_stock_entero"),
    "Migración 00024 define CONSTRAINT check_stock_entero"
  );
  assert(
    migrationContent.includes("unidad_medida NOT IN ('unidad', 'par', 'caja')"),
    "Constraint comprueba unidades ('unidad', 'par', 'caja')"
  );
  assert(
    migrationContent.includes("CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario"),
    "Migración 00024 actualiza RPC registrar_movimiento_inventario"
  );
  assert(
    migrationContent.includes("p_cantidad != FLOOR(p_cantidad)"),
    "RPC registrar_movimiento_inventario valida p_cantidad != FLOOR(p_cantidad)"
  );
  assert(
    migrationContent.includes("CREATE OR REPLACE FUNCTION public.procesar_venta_transaccion"),
    "Migración 00024 actualiza RPC procesar_venta_transaccion"
  );
  assert(
    migrationContent.includes("v_cantidad != FLOOR(v_cantidad)"),
    "RPC procesar_venta_transaccion valida v_cantidad != FLOOR(v_cantidad)"
  );

  console.log("\n================================================================");
  console.log(`RESUMEN DE PRUEBAS: ${totalPassed} PASADAS | ${totalFailed} FALLADAS`);
  console.log("================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPrecisionTests().catch((err) => {
  console.error("Error ejecutando suite de tests:", err);
  process.exit(1);
});
