# UI/UX Brief de Diseño

**Proyecto:** Sistema de Inventario y Control de Ventas
**Versión:** 1.0

## 1. Principios de diseño
- **Velocidad sobre estética.** El POS se usa de pie, en mostrador, posiblemente con clientes esperando — cada segundo cuenta.
- **Claridad sin curva de aprendizaje.** Un solo usuario, sin onboarding formal — la interfaz debe explicarse sola.
- **Confianza en los números.** Todo monto visible debe indicar claramente la moneda (USD/Bs); la ambigüedad de moneda es el error más costoso posible en este dominio.
- **Honestidad sobre el estado de conexión.** El usuario siempre debe saber si está operando offline y si hay datos pendientes de sincronizar.

## 2. Sistema de diseño (base)
- **Componentes:** shadcn/ui sobre Tailwind — coherente con tu stack Next.js/Vercel, acelera el desarrollo solo.
- **Iconografía:** lucide-react.
- **Tipografía:** sans-serif de alta legibilidad (ej. Inter), tamaño base de 16px mínimo — se usará en ambientes con luz variable de tienda.
- **Paleta sugerida:** neutros (grises/blancos) como base, un color primario de marca (a definir), y colores semánticos fijos:
  - Verde → confirmaciones, stock saludable, online.
  - Ámbar → alertas (stock bajo, tasa desactualizada).
  - Rojo → errores, stock negativo, fiado vencido.
  - Azul/gris → estado offline (informativo, no es un error).

## 3. Layout general
- Sidebar de navegación fija (Dashboard, POS, Inventario, Clientes, Reportes, Configuración) + panel principal.
- POS en pantalla completa cuando está activo, para minimizar distracciones durante la venta.
- Dashboard como pantalla de inicio: ventas del día, alertas de stock bajo, resumen de fiado pendiente, tasa de cambio activa y su antigüedad.

## 4. Pantallas clave
| Pantalla | Elementos principales |
|---|---|
| Login | Email/password o magic link, mínimo texto |
| Dashboard | Tarjetas de resumen: ventas hoy, stock bajo, fiado pendiente, tasa activa |
| POS | Buscador con autocompletado, carrito lateral, totales en USD y Bs simultáneos, selector de método de pago |
| Inventario (lista) | Tabla filtrable por categoría/proveedor, indicador visual de stock bajo, buscador |
| Inventario (detalle) | Datos del producto, historial de movimientos, botón de ajuste rápido |
| Clientes | Lista con saldo pendiente visible, buscador |
| Cliente (detalle) | Historial de compras y abonos, botón "Registrar abono" |
| Reportes | Selector de rango de fechas, gráficos simples (ventas, top productos, margen) |
| Configuración | Tasa de cambio (con fecha de última actualización visible), categorías, proveedores |

## 5. Patrones de interacción críticos
- **Búsqueda tipo autocomplete** en POS — por nombre, SKU o código de barras, con resultados desde la primera tecla.
- **Atajos de teclado** en POS (ej. Enter para agregar, F2 para buscar) — el mostrador rara vez usa el mouse con fluidez.
- **Confirmación explícita** antes de: anular venta, eliminar producto, eliminar cliente con saldo pendiente.
- **Doble visualización de montos** (USD / Bs) en cualquier pantalla donde se muestre dinero — nunca uno solo sin el otro.

## 6. Responsive
- **Prioridad 1:** desktop/tablet en horizontal — es el entorno real del punto de venta.
- **Prioridad 2:** mobile — solo para consulta rápida de inventario/reportes fuera del mostrador, no para operar el POS completo.

## 7. Estados de la interfaz
- **Loading:** skeletons, no spinners genéricos sin contexto.
- **Vacío:** mensajes accionables ("Aún no hay productos — Agregar el primero").
- **Error:** mensaje claro + acción de reintento; nunca un error técnico crudo.
- **Offline:** badge persistente y visible ("Sin conexión — N ventas pendientes de sincronizar"), nunca silencioso.
- **Tasa de cambio desactualizada (más de 24h):** banner ámbar en Dashboard y en POS.
