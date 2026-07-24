import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  calcularSubtotalUsd,
  calcularTotalUsd,
  convertirABolivares,
  calcularMargenGanancia,
} from '../src/lib/calculations';

// Configuración de cliente Supabase Cloud para pruebas de integración RPC
const url = 'https://celczpjsidmkiudhnijq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbGN6cGpzaWRta2l1ZGhuaWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTYwMjksImV4cCI6MjA5OTk5MjAyOX0.2kE6i8TF1fXKSywqAPJvxzNM-lLy__bW1zEBbPt3g-o';
const supabase = createClient(url, key);

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
  console.log('================================================================');
  console.log('SUITE DE TESTS UNITARIOS E INTEGRACIÓN — LÓGICA CRÍTICA (FASE 6)');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. TESTS UNITARIOS: CÁLCULO DE TOTALES Y MONEDA
  // -------------------------------------------------------------
  console.log('--- 1. CÁLCULO DE TOTALES Y CONVERSIÓN DE MONEDA ---');
  
  const itemsTest = [
    { cantidad: 3, precio_unitario_usd: 12.50 }, // 37.50
    { cantidad: 1.5, precio_unitario_usd: 10.00 }, // 15.00
  ];
  const subtotal = calcularSubtotalUsd(itemsTest);
  assert(subtotal === 52.50, 'Cálculo de subtotal exacto ($52.50 USD)');

  const totalConDescuento = calcularTotalUsd(subtotal, 5.00);
  assert(totalConDescuento === 47.50, 'Cálculo de total con descuento ($47.50 USD)');

  const totalBs = convertirABolivares(totalConDescuento, 42.50);
  assert(totalBs === 2018.75, 'Conversión a Bolívares a tasa 42.50 (Bs 2,018.75)');

  const margen = calcularMargenGanancia(100.00, 60.00);
  assert(margen.gananciaBrutaUsd === 40.00 && margen.porcentajeMargen === 40.00, 'Margen de ganancia exacto (40.00%)');

  // -------------------------------------------------------------
  // 2. TESTS DE INTEGRACIÓN RPC: ATOMICIDAD Y CONTROL DE STOCK
  // -------------------------------------------------------------
  console.log('\n--- 2. ATOMICIDAD RPC Y CONTROL DE STOCK ---');
  
  await supabase.auth.signInWithPassword({ email: 'admin@test.com', password: 'AdminPassword123!' });

  const sku = 'TEST-UNIT-' + Date.now().toString().slice(-5);
  const { data: prod } = await supabase.from('productos').insert({
    sku,
    nombre: 'Producto Unit Test Stock',
    precio_costo_usd: 10.00,
    precio_venta_usd: 20.00,
    stock_actual: 5.0,
    stock_minimo: 1.0,
    unidad_medida: 'unidad',
    activo: true
  }).select().single();

  assert(prod !== null, 'Creación de producto de prueba para stock');

  // Intento de venta de 10 unidades sin permitir stock negativo debe rebotar
  const { error: errStockInsuficiente } = await supabase.rpc('procesar_venta_transaccion', {
    p_cliente_id: null,
    p_subtotal_usd: 200.00,
    p_descuento_usd: 0,
    p_total_usd: 200.00,
    p_tasa_cambio_aplicada: 42.50,
    p_total_bs: 8500.00,
    p_metodo_pago: 'efectivo_usd',
    p_items: [{ producto_id: prod.id, cantidad: 10, precio_unitario_usd: 20.00, subtotal_usd: 200.00 }],
    p_permitir_stock_negativo: false,
    p_client_tx_id: crypto.randomUUID(),
    p_autorizado_por: null,
    p_origen_autorizacion: null
  });

  assert(errStockInsuficiente !== null, 'Rechazo de venta sin stock suficiente cuando permitir_stock_negativo=false');

  // -------------------------------------------------------------
  // 3. TESTS DE INTEGRACIÓN RPC: IDEMPOTENCIA COLA OFFLINE
  // -------------------------------------------------------------
  console.log('\n--- 3. IDEMPOTENCIA COLA OFFLINE (client_tx_id) ---');
  
  const txId = crypto.randomUUID();
  const { data: v1 } = await supabase.rpc('procesar_venta_transaccion', {
    p_cliente_id: null,
    p_subtotal_usd: 20.00,
    p_descuento_usd: 0,
    p_total_usd: 20.00,
    p_tasa_cambio_aplicada: 42.50,
    p_total_bs: 850.00,
    p_metodo_pago: 'efectivo_usd',
    p_items: [{ producto_id: prod.id, cantidad: 1, precio_unitario_usd: 20.00, subtotal_usd: 20.00 }],
    p_permitir_stock_negativo: false,
    p_client_tx_id: txId,
    p_autorizado_por: null,
    p_origen_autorizacion: null
  });

  const { data: v2 } = await supabase.rpc('procesar_venta_transaccion', {
    p_cliente_id: null,
    p_subtotal_usd: 20.00,
    p_descuento_usd: 0,
    p_total_usd: 20.00,
    p_tasa_cambio_aplicada: 42.50,
    p_total_bs: 850.00,
    p_metodo_pago: 'efectivo_usd',
    p_items: [{ producto_id: prod.id, cantidad: 1, precio_unitario_usd: 20.00, subtotal_usd: 20.00 }],
    p_permitir_stock_negativo: false,
    p_client_tx_id: txId,
    p_autorizado_por: null,
    p_origen_autorizacion: null
  });

  assert(v1.venta_id !== undefined, 'Primer procesado de venta asigna venta_id');
  assert(v2.duplicado === true && v2.venta_id === v1.venta_id, 'Reintento con el mismo client_tx_id retorna duplicado=true sin duplicar venta');

  // Limpieza de datos de prueba
  await supabase.from('productos').delete().eq('id', prod.id);

  console.log('\n================================================================');
  console.log(`RESUMEN DE PRUEBAS: ${totalPassed} PASADAS | ${totalFailed} FALLADAS`);
  console.log('================================================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTestSuite();
