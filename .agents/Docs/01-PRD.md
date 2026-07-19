# PRD — Sistema de Inventario y Control de Ventas

**Proyecto:** [Nombre de la ferretería]
**Versión:** 1.0 · **Fecha:** 16 de julio de 2026 · **Autor:** Andrés Bonilla

## 1. Resumen ejecutivo
Aplicación web para gestionar inventario y ventas de una ferretería/repuestera de ubicación única, operada por un único usuario (dueño/administrador), con soporte de moneda dual (USD/Bs) y resiliencia ante conectividad intermitente.

## 2. Problema
Control de inventario y ventas probablemente manual (cuaderno/Excel) o inexistente, con riesgo de: pérdida de stock no detectada, precios desactualizados frente a la tasa de cambio, fiado sin seguimiento confiable, ausencia de datos para decisiones de compra.

## 3. Objetivos
- **O1:** Reducir el tiempo de registro de una venta a menos de 30 segundos.
- **O2:** Eliminar discrepancias de inventario por falta de registro de movimientos.
- **O3:** Visibilidad en tiempo real del valor del inventario en USD y en Bs.
- **O4:** Seguimiento confiable de cuentas por cobrar (fiado).
- **O5:** Operar sin interrupciones aunque falle la conexión a internet.

## 4. Usuario objetivo
Un único perfil: **Dueño/Administrador** — registra ventas en mostrador, gestiona inventario, actualiza la tasa de cambio y consulta reportes. No es técnico avanzado, pero está cómodo con tecnología básica (PC/tablet).

*Supuesto: v1 no contempla cajeros ni roles adicionales, según confirmaste. Si más adelante se contrata personal, el modelo de permisos deberá revisarse — ver TRD §5 y Esquema de Backend §5.*

## 5. Alcance — v1 (MVP)

### Must-have
- CRUD de productos: SKU, nombre, categoría, proveedor, unidad de medida (unidad/caja/metro/kilo/litro/par), precio costo y venta en USD, stock actual, stock mínimo.
- Categorías de producto (plomería, electricidad, herramientas, pintura, materiales, ferretería general — editable).
- Registro y consulta de proveedores.
- Movimientos de inventario: entrada (compra), salida (venta/merma/ajuste), con historial auditable.
- Punto de venta (POS): búsqueda rápida de producto, carrito, aplicar descuento, selección de método de pago, cierre de venta con actualización automática de inventario.
- Métodos de pago: efectivo USD, efectivo Bs, pago móvil, transferencia, tarjeta, fiado.
- Gestión de tasa de cambio: registro manual de tasa activa; cada venta guarda snapshot de la tasa usada.
- Clientes y fiado: registro de cliente, saldo pendiente, registro de abonos, historial.
- Reportes: ventas por período, productos más vendidos, margen/ganancia, inventario valorizado (USD y Bs), cuentas por cobrar.
- Operación offline: registrar ventas y consultar inventario sin conexión; sincronizar al reconectar.
- Autenticación segura de un solo usuario.

### Should-have
- Alertas de stock bajo (mínimo configurable por producto).
- Recibo de venta imprimible/exportable (PDF simple).
- Búsqueda por código de barras (si el producto lo tiene).

### Could-have (backlog explícito, no v1)
- Integración con impresora térmica ESC/POS.
- Actualización automática de tasa vía API externa.
- Exportación de reportes a Excel.

## 6. Fuera de alcance (v1)
- Multi-sucursal.
- Múltiples usuarios/roles (cajeros, empleados).
- Facturación fiscal electrónica (SENIAT) — *a validar si es requisito legal para el negocio; no incluido salvo confirmación.*
- Tienda online / e-commerce público.
- App móvil nativa (se cubre con diseño web responsive/PWA).

## 7. Supuestos
- Negocio de ubicación única, sin necesidad de sincronizar entre sucursales.
- El dueño acepta capturar manualmente la tasa de cambio; automatización es mejora futura.
- No hay requisito legal inmediato de facturación fiscal electrónica (a confirmar).
- Hardware disponible: al menos una PC o tablet en el punto de venta.

## 8. Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Conectividad intermitente pierde ventas | Alto | Arquitectura offline-first (ver TRD) |
| Tasa de cambio desactualizada distorsiona precios | Alto | Snapshot de tasa por venta + alerta visual si la tasa tiene más de 24h |
| Único usuario = punto único de fallo (vacaciones, enfermedad) | Medio | Documentar proceso; roles multiusuario en backlog |
| SKU/código de barras inconsistente en productos de ferretería | Medio | Permitir código interno propio, código de barras opcional |

## 9. Métricas de éxito
- 100% de ventas registradas en el sistema (vs. cuaderno/memoria).
- Reducción a cero de "sorpresas" de stock negativo no explicado.
- Reporte de cuentas por cobrar disponible en menos de 5 segundos.

## 10. Glosario
- **Fiado:** venta a crédito informal a un cliente conocido, sin contrato formal.
- **Tasa BCV:** tasa de cambio oficial publicada por el Banco Central de Venezuela.
- **SKU:** código interno único de producto.
