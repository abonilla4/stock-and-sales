---
name: logica-critica-ventas-stock
description: Reglas de negocio no negociables para la afectación de stock y el flujo de ventas del sistema de inventario. Usa este skill SIEMPRE que se toque código de confirmación de venta, descuento o ajuste de stock, cancelación o anulación de ventas, autorización de venta con stock insuficiente, cálculo de totales, o cualquier función/endpoint que modifique stock_actual, ventas, detalle_ventas o movimientos_inventario — incluso si la tarea parece un cambio menor como agregar un campo o corregir un bug de UI.
---

# Lógica crítica de ventas y stock

Este es el módulo más sensible del sistema: un error aquí produce pérdida de dinero o de inventario real, no solo un bug visual. Antes de tocar cualquier código relacionado con ventas o stock, aplica las reglas de esta guía.

## Por qué importa

El stock y el dinero son los dos recursos que este sistema existe para proteger. Un descuento de stock duplicado, una venta que se guarda sin descontar inventario, o un folio generado antes de confirmar la transacción, son bugs que un test superficial no detecta pero que un cajero o un cliente sí notan — y cuestan dinero real.

## Regla 1: el carrito nunca toca stock

El carrito vive en memoria/sesión del cliente. El stock **solo** se descuenta al confirmar la venta, nunca al agregar un producto al carrito. No implementes "reserva de stock en carrito abierto" salvo que se indique explícitamente — es una función de Fase 2, no del MVP.

## Regla 2: la confirmación de venta es una transacción atómica

Al presionar "Confirmar venta", el flujo correcto es:

1. `BEGIN TRANSACTION`
2. Por cada línea del carrito: leer `stock_actual` con bloqueo de fila (`SELECT ... FOR UPDATE`) o control optimista con columna de versión.
3. Validar que `stock_actual >= cantidad_solicitada` para cada línea.
4. Si **todas** las líneas pasan: `UPDATE` de stock por cada producto, `INSERT` de la cabecera de venta, `INSERT` de las líneas de detalle, `COMMIT`.
5. Si **alguna** línea falla: `ROLLBACK` completo. No debe quedar ni una venta a medias ni un stock descontado sin venta registrada.

**No negociable:** todo o nada. Nunca hagas `UPDATE`s de stock sueltos fuera de esta transacción, ni siquiera "para simplificar" un fix rápido.

**Por qué el bloqueo de fila:** sin él, dos cajeros vendiendo el mismo producto casi al mismo tiempo pueden leer el mismo `stock_actual` antes de que el otro confirme, y ambos venden la última unidad. Es una condición de carrera real en un negocio con más de un punto de venta simultáneo.

## Regla 3: el folio se genera solo después del COMMIT

Nunca generes el folio/recibo antes de que la transacción haya confirmado exitosamente. Si generas el folio antes y la transacción falla, tienes un recibo fantasma sin venta real detrás.

## Regla 4: una única función centralizada para modificar stock

Toda modificación de stock — por venta, ajuste manual, o anulación — pasa por una única función/servicio de "movimiento de inventario". Nunca escribas un `UPDATE productos SET stock_actual = ...` disperso en distintos archivos o endpoints. Cada movimiento debe generar un registro en `movimientos_inventario` con: `producto_id`, `tipo` (entrada/salida/ajuste/venta/anulación), `cantidad`, `motivo`, `usuario_id`, `fecha`.

## Regla 5: venta con stock insuficiente requiere autorización de Administrador

Por defecto, el sistema bloquea la confirmación si `cantidad_solicitada > stock_disponible`. La única excepción:

1. El sistema detecta la insuficiencia y bloquea el botón de confirmar.
2. Se ofrece "Solicitar autorización".
3. Se piden credenciales de un usuario con rol Administrador (el Cajero no puede autorizarse a sí mismo).
4. Si el Administrador autoriza, la venta se completa y el stock puede quedar en negativo — es un estado válido ("pendiente de reposición"), no un error del sistema.
5. La venta queda registrada con `autorizado_por` (id del Administrador) y `timestamp` de la autorización.

Si estás tocando reportes o el dashboard: asegúrate de que puedan mostrar stock negativo sin romperse (sin asumir `stock_actual >= 0` en ningún lado).

## Regla 6: el precio se congela en el momento de la venta

`detalle_ventas.precio_unitario` se guarda al momento de la transacción y nunca se recalcula contra el precio actual del producto. Si el precio de un producto cambia después, las ventas históricas no deben verse afectadas.

## Anti-patrones a rechazar en revisión de código

- `UPDATE productos SET stock_actual = stock_actual - ?` fuera de la función centralizada de movimientos de inventario.
- Cálculo de totales de una venta pasada usando `productos.precio_venta` actual en vez de `detalle_ventas.precio_unitario`.
- Generación de folio/número de recibo antes del `COMMIT`.
- Falta de `FOR UPDATE` (o equivalente) al leer stock dentro de una transacción de venta.
- Cualquier validación de "hay stock suficiente" que ocurra solo en el frontend sin repetirse en el backend.
- Bloqueos de UI para stock negativo en dashboard/reportes (debe ser un estado mostrable, no un error).

## Al terminar un cambio en este módulo

Antes de dar por cerrada una tarea que toque ventas o stock, verifica: ¿la operación es atómica? ¿hay bloqueo de fila? ¿el folio se genera después del commit? ¿pasa por la función centralizada de movimientos de inventario? ¿el precio queda congelado? ¿la excepción de stock negativo queda auditada con usuario y timestamp?
