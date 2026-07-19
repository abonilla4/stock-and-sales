---
name: datos-seguridad-api
description: Esquema de base de datos, principios de seguridad Zero-Trust y contrato de API de este proyecto de inventario y ventas. Usa este skill siempre que se creen migraciones o modelos ORM, se agregue un campo o tabla, se trabaje en endpoints de la API, autenticación, autorización, manejo de contraseñas, o cualquier código que reciba input de un cliente externo.
---

# Bases de datos, seguridad y API

## El backend es la única puerta a la base de datos

El frontend nunca ejecuta consultas directas ni conoce credenciales de base de datos. La cadena de comunicación es siempre: `Cliente (web) → API Backend → Base de datos`. Ningún módulo puede saltarse esta cadena, tampoco una futura app móvil o integración externa.

## Zero-Trust: toda petición al backend es no confiable por defecto

No importa el origen (formulario web, app móvil futura, integración externa). Cada endpoint debe:

1. Validar el esquema de entrada **antes** de tocar la lógica de negocio o la base de datos, usando la librería de validación del stack (Zod en Node/TypeScript, Pydantic en Python).
2. Cubrir como mínimo: tipos de dato correctos, rangos válidos (`cantidad > 0`, `precio_venta >= 0`, `stock_minimo >= 0`), longitud de strings, y formatos (email, SKU).
3. Usar **siempre** consultas parametrizadas — nunca concatenación de strings para armar SQL.

Estas dos capas son distintas y ambas obligatorias: la validación de esquema evita que datos corruptos lleguen a la lógica de negocio; los parámetros preparados evitan que lleguen a la base de datos como código ejecutable. Una no sustituye a la otra.

## Manejo de credenciales

- Ninguna contraseña se almacena en texto plano ni aparece en logs, nunca, ni siquiera en un log de debug "temporal".
- Algoritmo de hash: Argon2id (preferido) o bcrypt (alternativa válida si el stack no tiene soporte maduro para Argon2). Nunca uses MD5, SHA-256 sin salt, ni ningún algoritmo de propósito general.
- El hash se calcula siempre en el backend, nunca en el frontend, y nunca se incluye en ninguna respuesta de la API — ni siquiera al propio dueño de la cuenta.
- Secretos de configuración (credenciales de base de datos, claves de firma de JWT) van en variables de entorno, nunca hardcodeados en el repositorio.

## Roles y permisos: matriz de referencia

Dos roles fijos en el MVP: `Administrador` y `Cajero/Vendedor`. No hay auto-registro público — solo un Administrador crea usuarios.

| Acción | Cajero/Vendedor | Administrador |
|---|:---:|:---:|
| Ver productos y stock | ✅ | ✅ |
| Crear/editar/eliminar productos | ❌ | ✅ |
| Ajustar stock manualmente | ❌ | ✅ |
| Registrar una venta | ✅ | ✅ |
| Autorizar venta con stock insuficiente | ❌ | ✅ |
| Anular venta ya confirmada | ❌ | ✅ |
| Ver reportes | Solo ventas propias | Todos |
| Gestionar usuarios | ❌ | ✅ |
| Gestionar proveedores | Solo lectura | ✅ |

**No negociable:** esta matriz se valida en el backend en cada endpoint sensible, sin excepción. Ocultar un botón en el frontend es UX (ver skill `frontend-desarrollo`), no seguridad — un usuario técnico puede llamar el endpoint directamente saltándose la interfaz. Al agregar un endpoint nuevo, la pregunta es "¿qué rol puede llamar esto, y dónde lo estoy validando?" — la respuesta debe ser un middleware/guard en el backend, nunca una condición en un componente de React.

Cualquier autorización de excepción (venta con stock insuficiente) debe registrar quién autorizó y cuándo (`autorizado_por`, `timestamp`) — es un evento auditable, nunca una acción silenciosa.

## Esquema de datos del MVP (Fase 1)

Usa siempre estos nombres de tabla y campo — no los traduzcas ni los renombres por conveniencia, para mantener el esquema consistente con el documento de arquitectura del proyecto.

**roles**: id, nombre
**usuarios**: id, nombre, email (único), password_hash, rol_id (FK), activo
**categorias**: id, nombre
**proveedores**: id, nombre, contacto, telefono, email, direccion
**productos**: id, sku (único, indexado), nombre, descripcion, categoria_id (FK), proveedor_id (FK), precio_venta, costo, stock_actual, stock_minimo, activo
**clientes**: id, nombre, telefono, email
**ventas**: id, folio (único, se genera tras commit), cliente_id (FK, nullable = "público general"), usuario_id (FK, cajero que atendió), fecha, subtotal, impuestos, total, metodo_pago, estado (completada/cancelada/anulada), autorizado_por (FK a usuarios, nullable)
**detalle_ventas**: id, venta_id (FK), producto_id (FK), cantidad, precio_unitario (congelado, no referencia precio_venta actual), subtotal_linea
**movimientos_inventario**: id, producto_id (FK), tipo (entrada/salida/ajuste/venta/anulación), cantidad, motivo, usuario_id (FK), fecha

**Relaciones:** roles 1:N usuarios · categorias 1:N productos · proveedores 1:N productos (un solo proveedor principal por producto en el MVP; no implementes una tabla intermedia muchos-a-muchos salvo que se indique explícitamente, es de Fase 2) · clientes 1:N ventas · usuarios 1:N ventas y 1:N movimientos_inventario · ventas 1:N detalle_ventas · productos 1:N detalle_ventas y 1:N movimientos_inventario.

**Reglas de esquema:**
- `sku` siempre único e indexado a nivel de base de datos, no solo validado en aplicación.
- `movimientos_inventario` existe desde el MVP como tabla de auditoría ligera — cualquier cambio de stock inserta un registro aquí (ver skill `logica-critica-ventas-stock`).
- `precio_unitario` en `detalle_ventas` se congela al momento de la venta; nunca lo hagas una referencia al precio actual del producto.
- No agregues un `CHECK (stock_actual >= 0)` a nivel de base de datos — rompería el flujo de autorización de venta con stock insuficiente.

**Antes de agregar una tabla o campo nuevo:** si la tarea pide múltiples proveedores por producto, variantes combinatorias, órdenes de compra formales, devoluciones/notas de crédito, multi-sucursal, roles adicionales, o facturación fiscal electrónica, es de una fase posterior — confírmalo explícitamente antes de extender el esquema del MVP.

## Contrato de API

- Usa un único formato de casing para los nombres de campo en las respuestas de la API (por ejemplo, `camelCase`) y no lo mezcles con el `snake_case` de la base de datos dentro de la misma respuesta — la capa de servicio es responsable de esa traducción, no cada endpoint por su cuenta.
- Documenta el contrato de cada endpoint (request/response) a medida que se crea, no al final del proyecto — evita que frontend y backend diverjan sobre qué forma tiene un objeto `venta` o `producto`.

## Anti-patrones a rechazar en revisión de código

- Un endpoint que confía en un campo `rol` enviado por el cliente en vez de leerlo de la sesión/token verificado en el backend.
- Validación de tipo/rango que existe solo en el formulario de React y no se repite en el endpoint.
- Contraseñas o cadenas de conexión a base de datos escritas directamente en el código fuente.
- Un endpoint sensible (crear producto, ajustar stock, anular venta) sin verificación explícita de rol Administrador.
- Concatenación de strings para construir queries SQL, aunque sea "solo para un reporte interno".
