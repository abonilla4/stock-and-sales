# Walkthrough: Fase 5 — Offline-first completada

Hemos completado la **Fase 5 (Offline-first)** respetando todas las reglas no negociables del proyecto y la estrategia técnica establecida en `02-TRD.md`, `03-Flujo-App.md` y `04-UIUX-Brief.md`.

---

## Resumen de cambios implementados

### 1. Base de datos local IndexedDB (Dexie.js)
- **`src/lib/offline/db.ts`**: Definición de esquemas para `productos`, `clientes`, `tasas_cambio`, `cola_ventas` (FIFO queue) y `registro_auditoria`.
- **`src/lib/offline/sync-cache.ts`**: Funciones para descargar y actualizar el catálogo local desde Supabase cuando se tiene conexión, así como realizar búsquedas offline filtradas por Nombre, SKU o Código de Barras en menos de 300ms.

### 2. Service Worker y PWA
- **`public/manifest.json`**: Manifiesto web para hacer el POS instalable en escritorio/tablet.
- **`public/sw.js`**: Service Worker para caching de assets estáticos y páginas HTML.
- **`src/components/sw-register.tsx`**: Componente de registro automático del Service Worker en el navegador.

### 3. Manager de Ventas y Cola de Sincronización
- **`src/lib/offline/sales-manager.ts`**:
  - `procesarVentaPOS`: Si hay red (y no está activada la simulación offline), intenta confirmar la venta online en Supabase. Si falla la red o el navegador está offline, guarda la transacción en `cola_ventas` con estado `'pendiente'` y `client_tx_id` único, emitiendo un recibo preliminar.
  - `sincronizarColaVentas`: Al restaurar la conexión, recorre las ventas pendientes en orden cronológico (FIFO) y ejecuta la función centralizada `confirmarVentaPOS` (que invoca la RPC atómica `procesar_venta_transaccion` en Supabase), registrando el resultado en `registro_auditoria`.

### 4. Indicadores de Estado y UI/UX
- **`src/components/offline-network-context.tsx`**: Proveedor global del estado de red, escuchando eventos `online`/`offline` y manejando la simulación.
- **`src/components/network-status-badge.tsx`**: Componente visible en la barra superior del Dashboard y POS que incluye:
  - Badge de estado `Online` / `Offline` (o `Simulación Offline`).
  - Badge de número de ventas pendientes por sincronizar (con animación).
  - Botón "Sincronizar" para forzar sincronización manual.
  - Switch "Simular Offline" (para pruebas en desarrollo).
- **`src/components/ui/switch.tsx`**: Componente de interruptor toggle sintonizado con Shadcn.

---

## Verificación y Pruebas Realizadas

1. **TypeScript check**: `npx tsc --noEmit` ejecutado sin ningún error.
2. **Next.js Production Build**: `npm run build` ejecutado de manera totalmente limpia y exitosa (13 páginas estáticas y dinámicas compiladas).
3. **Cumplimiento de Reglas AGENTS.md**: Toda sincronización offline pasa única y exclusivamente por `confirmarVentaPOS` (`procesar_venta_transaccion` en transacción atómica), sin escrituras dispersas directas a tablas de negocio.
