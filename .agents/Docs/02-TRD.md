# TRD — Requisitos Técnicos

**Proyecto:** Sistema de Inventario y Control de Ventas — [Nombre de la ferretería]
**Versión:** 1.0 · **Fecha:** 16 de julio de 2026

## 1. Arquitectura general
- **Frontend + API:** Next.js (App Router) desplegado en Vercel — SSR/ISR para dashboard, API routes serverless para lógica de negocio que no debe vivir solo en el cliente (cálculos de reportes agregados, actualización de tasa).
- **Backend de datos:** Supabase (Postgres gestionado + Auth + Storage + Realtime) — minimiza backend custom; el cliente puede hablar directo con Supabase protegido por Row Level Security (RLS).
- **Patrón de acceso a datos:** Repository pattern en el frontend (capa de abstracción sobre el cliente Supabase) para poder migrar de proveedor de BD en el futuro sin reescribir la UI.

## 2. Requisitos no funcionales
| Categoría | Requisito |
|---|---|
| Disponibilidad | La app debe permitir vender e inventariar sin conexión a internet |
| Performance | Búsqueda de producto en POS debe responder en menos de 300ms (dataset local) |
| Escalabilidad | Baja — 1 ubicación, 1 usuario; no se optimiza para múltiples tenants |
| Seguridad | RLS en todas las tablas; ninguna tabla accesible sin autenticación |
| Mantenibilidad | Código mantenible por un solo desarrollador asistido por IA — convenciones claras, TypeScript |
| Costo | Priorizar tiers gratuitos (Vercel Hobby, Supabase Free) mientras el volumen lo permita |

## 3. Offline-first — estrategia técnica
Esta es la restricción más crítica del proyecto, dada la conectividad intermitente en Venezuela.

- **Almacenamiento local:** IndexedDB en el navegador (vía Dexie.js) como caché y cola de escritura.
- **Patrón:** local-first — toda escritura (venta, ajuste de inventario) se guarda primero en IndexedDB y se marca como `pendiente_sync`; un service worker (PWA) reintenta sincronizar con Supabase cuando detecta conexión.
- **Resolución de conflictos:** con un único usuario el riesgo de conflictos concurrentes es bajo, pero puede ocurrir si se usa desde dos dispositivos (PC + tablet) sin sincronizar entre sí. Estrategia recomendada: *last-write-wins* por `updated_at`, con log de auditoría para revisar manualmente cualquier discrepancia de stock.
- **PWA instalable:** manifest + service worker para que el punto de venta funcione como app instalada, sobreviviendo recargas de página y cortes de red.
- **Indicador visual obligatorio** de estado offline/online y de ventas pendientes de sincronizar (ver UI/UX Brief).

## 4. Manejo de moneda dual (USD/Bs)
- Precio base almacenado en **USD** (estable frente a la depreciación del bolívar).
- Tasa de cambio activa: registro manual por el dueño en v1. Cada venta guarda un **snapshot** de `tasa_cambio_aplicada` — el histórico de ventas nunca se recalcula con la tasa actual.
- Mejora futura (backlog, could-have): importar la tasa automáticamente desde una API pública. Opciones evaluadas:
  - **DolarApi.com** — proyecto open source y gratuito que expone la tasa BCV y otras referencias vía REST/JSON; buena opción para empezar sin costo.
  - Servicios alternativos con planes gratuitos limitados (algunos miles de consultas/mes) si más adelante se necesita mayor confiabilidad, histórico o SLA.
  - Cualquiera de estas se integraría desde un API route de Next.js (server-side), para no exponer llamadas externas directamente al cliente y poder cachear la respuesta.

## 5. Modelo de usuarios y permisos
- v1: un solo usuario administrador vía Supabase Auth (email/password o magic link).
- RLS: políticas simples de "solo el propietario autenticado puede leer/escribir" en todas las tablas de negocio.
- Diseñar el campo `profiles.role` desde ahora, aunque hoy solo exista un rol, para no tener que migrar datos si más adelante se agregan cajeros (ver Esquema de Backend §5).

## 6. Integraciones
| Integración | v1 | Notas |
|---|---|---|
| Impresora térmica ESC/POS | No | Backlog — requiere WebUSB/WebBluetooth o app puente |
| API de tasa de cambio | No | Backlog — ver §4 |
| Facturación fiscal (SENIAT) | No | Pendiente de confirmar requisito legal |
| Exportación a Excel/PDF | Should-have | PDF simple vía librería cliente (ej. jsPDF); Excel en backlog |

## 7. Ambientes y despliegue
- **Desarrollo:** Supabase local (CLI) o proyecto de desarrollo separado + Next.js local.
- **Preview:** Vercel Preview Deployments por cada rama/PR.
- **Producción:** Vercel producción + proyecto Supabase de producción, con backups automáticos habilitados.
- **Variables de entorno:** claves de Supabase gestionadas vía Vercel Environment Variables, nunca en el repositorio.

## 8. Testing
Dado el contexto de desarrollo solo + IA:
- Tests unitarios obligatorios en lógica crítica: cálculo de totales, conversión de moneda, actualización de stock, cola de sincronización offline.
- Testing manual guiado por checklist para flujos de UI (ver Plan de Implementación, Definition of Done por fase).
- Recomendado: correr tu agente `security-auditor` existente antes de cada release para revisar RLS y exposición de datos — mismo patrón de riesgo que identificaste en VenAyuda Médica (select('*') sin filtrar, formularios sin rate limiting).

## 9. Observabilidad
- Logs de Supabase (queries, auth) y Vercel (build/runtime) como monitoreo básico v1.
- Backlog: tabla de auditoría de movimientos de inventario y ventas anuladas para trazabilidad completa.
