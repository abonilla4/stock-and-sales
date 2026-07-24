# Walkthrough — RPCs atómicas exclusivas

## Resumen

Eliminé **6 violaciones** donde campos críticos (`stock_actual`, `saldo_fiado`) se modificaban fuera de RPCs atómicas, y cerré el gap de idempotencia en la sincronización offline.

---

## Cambios realizados

### Nuevas migraciones SQL

| Archivo | Qué hace |
|---------|----------|
| [00008_registrar_movimiento_inventario_rpc.sql](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/supabase/migrations/00008_registrar_movimiento_inventario_rpc.sql) | Nueva RPC que bloquea la fila del producto con `FOR UPDATE`, calcula el nuevo stock, inserta en `movimientos_inventario` y actualiza `stock_actual` — todo atómico |
| [00009_upgrade_procesar_venta_rpc.sql](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/supabase/migrations/00009_upgrade_procesar_venta_rpc.sql) | Agrega columna `client_tx_id` a `ventas`, deduplicación en la RPC, e incremento atómico de `saldo_fiado` dentro de la transacción para ventas fiadas |

### Server Actions modificados

| Archivo | Qué cambió |
|---------|-----------|
| [pos/actions.ts](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/src/app/dashboard/pos/actions.ts) | Eliminado UPDATE disperso de `saldo_fiado` post-RPC (V1) + fallback completo de ~120 líneas (V2). Ahora pasa `client_tx_id` a la RPC |
| [clientes/actions.ts](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/src/app/dashboard/clientes/actions.ts) | Eliminado fallback con INSERT `pagos_fiado` + UPDATE `saldo_fiado` dispersos (V3). Solo usa la RPC |
| [inventario/actions.ts](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/src/app/dashboard/inventario/actions.ts) | Reemplazado SELECT + cálculo JS + UPDATE disperso (V4) por llamada a RPC `registrar_movimiento_inventario` |

### Sincronización offline

| Archivo | Qué cambió |
|---------|-----------|
| [sales-manager.ts](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/src/lib/offline/sales-manager.ts) | Ahora pasa `client_tx_id` a `confirmarVentaPOS` durante la sync, habilitando la deduplicación server-side |

### Reglas

| Archivo | Qué cambió |
|---------|-----------|
| [agents.md](file:///d:/Bonilla%20IA/Proyectos/Stock-and-Sales/agents.md) | 2 nuevas reglas no negociables: RPC exclusiva para campos críticos + prohibición de fallbacks |

---

## Verificación

| Check | Resultado |
|-------|-----------|
| `grep "\.update.*stock_actual" src/` | ✅ 0 resultados |
| `grep "\.update.*saldo_fiado" src/` | ✅ 0 resultados |
| `grep "no disponible" src/` | ✅ 0 resultados |
| `grep -i "fallback" src/` | ✅ Solo lectura offline (pos-search) y docstrings "NO hay fallback" |
| `npx next build` | ✅ Compiled successfully, 0 TypeScript errors |

---

## Próximo paso requerido

> [!IMPORTANT]
> Las migraciones `00008` y `00009` deben aplicarse en Supabase Cloud antes de que la app funcione en producción. Ejecuta:
> ```bash
> supabase db push
> ```
> O aplica los `.sql` manualmente en el SQL Editor de Supabase Dashboard.
