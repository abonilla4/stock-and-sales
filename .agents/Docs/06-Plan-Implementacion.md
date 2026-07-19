# Plan de Implementación

**Proyecto:** Sistema de Inventario y Control de Ventas
**Versión:** 1.0

## Enfoque
Desarrollo solo + asistido por IA (Claude Code / OpenCode). Fases secuenciales, cada una con Definition of Done clara antes de avanzar a la siguiente. Estimaciones en semanas-persona, asumiendo dedicación parcial (no full-time) — ajusta según tu disponibilidad real.

## Fase 0 — Setup (≈3-5 días)
- Crear repo, estructura Next.js (App Router) + TypeScript.
- Crear proyecto Supabase, aplicar esquema inicial (ver Esquema de Backend), habilitar RLS.
- Configurar Supabase Auth (usuario único).
- Configurar Vercel (deploy + preview branches) + variables de entorno.
- Configurar AGENTS.md y reglas de agentes para este repo, siguiendo tu convención existente.
- **DoD:** login funcional en producción, esquema de BD desplegado, primer deploy en Vercel accesible.

## Fase 1 — Core de inventario (≈1-2 semanas)
- CRUD de productos, categorías, proveedores.
- Registro de movimientos de inventario (entrada/salida/ajuste).
- Alertas de stock bajo en la UI.
- **DoD:** se puede dar de alta un producto, ajustar su stock manualmente, y ver el historial de movimientos.

## Fase 2 — Punto de venta y moneda (≈2 semanas)
- Gestión de tasa de cambio (manual) + histórico.
- POS: búsqueda, carrito, cierre de venta, descuento de stock automático.
- Métodos de pago (incluyendo fiado como opción, sin lógica de cobro todavía).
- **DoD:** una venta completa se registra, descuenta inventario y guarda el snapshot de tasa correctamente.

## Fase 3 — Clientes y fiado (≈1 semana)
- CRUD de clientes.
- Registro de abonos y cálculo de saldo pendiente.
- Vista de cuentas por cobrar.
- **DoD:** un ciclo completo de fiado (venta a crédito → abono parcial → saldo en cero) funciona de punta a punta.

## Fase 4 — Reportes y dashboard (≈1 semana)
- Dashboard con resumen del día.
- Reportes: ventas por período, top productos, margen, inventario valorizado.
- **DoD:** todos los reportes del PRD §5 devuelven datos correctos contra datos de prueba.

## Fase 5 — Offline-first (≈2 semanas — la fase más riesgosa técnicamente)
- IndexedDB (Dexie.js) como capa local.
- Service worker / PWA instalable.
- Cola de sincronización + resolución de conflictos (last-write-wins + log de auditoría).
- Indicadores visuales de estado offline/pendiente de sync.
- **DoD:** se puede completar una venta con el wifi apagado y esta aparece correctamente sincronizada al reconectar.

## Fase 6 — Pulido, seguridad y testing (≈1 semana)
- Pasar checklist de tu agente `security-auditor` (RLS, exposición de datos, inputs sin validar — mismo patrón que en VenAyuda Médica).
- Tests unitarios de lógica crítica (totales, conversión de moneda, stock).
- Revisión de estados vacíos/error/loading en todas las pantallas (ver UI/UX Brief §7).
- **DoD:** checklist de seguridad sin hallazgos críticos; app usable de principio a fin sin errores bloqueantes.

## Backlog explícito (fuera de v1)
- Multi-usuario/roles (cajeros).
- Facturación fiscal electrónica.
- Impresora térmica ESC/POS.
- Actualización automática de tasa vía API (DolarApi.com u otra).
- Exportación de reportes a Excel.
- Multi-sucursal.

## Dependencias entre fases
Fase 0 bloquea todo. Fase 2 depende de Fase 1 (necesita productos existentes). Fase 3 puede correr en paralelo parcial con Fase 4. Fase 5 (offline) conviene abordarla **después** de tener el flujo online estable — es más fácil añadir la capa offline sobre un modelo de datos ya probado que construir ambas cosas a la vez.

## Estrategia de despliegue
- Cada fase se mergea a `main` solo cuando pasa su DoD.
- Vercel Preview Deployments para probar cada fase antes de merge.
- Backups automáticos de Supabase activados desde Fase 0.

## Estimación total
≈7-10 semanas de dedicación parcial hasta v1 completo (Fases 0-6).
