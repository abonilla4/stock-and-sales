---
name: backend-desarrollo
description: Convenciones de organización y desarrollo del backend de este proyecto de inventario y ventas — límites entre módulos, capas dentro de cada módulo, manejo de errores y patrones de servicio. Usa este skill siempre que se cree o modifique un endpoint, controlador, servicio o cualquier código del backend, sin importar el módulo (autenticación, inventario, proveedores, ventas, clientes, reportes, dashboard).
---

# Backend: arquitectura y convenciones

## Los módulos no se tocan las tablas entre sí

Cada módulo (Autenticación, Inventario, Proveedores, Ventas, Clientes, Reportes, Dashboard) expone su propia lógica y se comunica con los demás únicamente a través de su capa de servicio, nunca accediendo directamente a las tablas de otro módulo. Ejemplo: si el módulo de Ventas necesita el precio de un producto, llama a la función del servicio de Inventario — no hace un `SELECT` directo a `productos` desde el código de Ventas.

Por qué: esto es lo que permite reemplazar o escalar un módulo en Fase 2/3 (por ejemplo, cuando Proveedores se convierta en un módulo de compras completo) sin reescribir todo lo que depende de él.

## Tres capas dentro de cada módulo

1. **Controlador/ruta**: recibe la petición HTTP, valida el esquema de entrada (ver skill `datos-seguridad-api`), llama al servicio correspondiente, devuelve la respuesta. No contiene lógica de negocio.
2. **Servicio**: aquí vive la lógica real — cálculos, reglas de negocio, orquestación de transacciones. Es la capa que debe ser fácil de testear sin simular una petición HTTP completa.
3. **Acceso a datos**: consultas a base de datos (ORM o queries), aisladas del resto — nadie fuera de esta capa arma SQL directamente.

Mantener el controlador delgado importa especialmente en el módulo de Ventas: la lógica descrita en el skill `logica-critica-ventas-stock` debe vivir en la capa de servicio, testeable de forma aislada.

## Manejo de errores consistente

- Usa un formato de respuesta de error uniforme en toda la API (código, mensaje, detalles opcionales) — no inventes un formato distinto por endpoint.
- Distingue claramente: validación (400), no autenticado (401), no autorizado por rol (403), no encontrado (404), conflicto de negocio como stock insuficiente (409 o un código de dominio explícito), error interno (500). Un frontend no puede reaccionar bien si "no hay stock" y "el servidor se cayó" devuelven el mismo código.
- Nunca expongas detalles internos (stack traces, mensajes crudos de la base de datos) en la respuesta al cliente — regístralos en logs del servidor, no en el body de la respuesta.

## Endpoints por módulo (referencia rápida)

- **Auth**: login, logout, creación de usuario (solo Administrador), reseteo de contraseña.
- **Inventario**: CRUD de productos, CRUD de categorías, ajuste manual de stock (con motivo obligatorio), búsqueda por SKU/nombre/categoría.
- **Proveedores**: CRUD de proveedor, listado de productos por proveedor.
- **Ventas**: crear venta (transaccional — ver `logica-critica-ventas-stock`), cancelar antes de confirmar, anular venta confirmada (solo Admin), historial filtrable.
- **Clientes**: CRUD de cliente, historial de compras por cliente.
- **Reportes**: ventas por rango de fechas, productos más vendidos, inventario actual, stock bajo.
- **Dashboard**: agregados de solo lectura sobre los módulos anteriores.

## Convenciones generales

- Usa async/await de forma consistente en todo el proyecto; no mezcles callbacks y promesas en el mismo módulo.
- Inyecta la conexión/cliente de base de datos en los servicios en lugar de importarla como singleton global en cada archivo — facilita testear con mocks o con una base de datos de prueba.
- Cualquier función que dependa del rol del usuario debe recibirlo del contexto de la petición ya autenticada (sesión/token verificado en el backend), nunca de un campo que el cliente envíe libremente en el body.

## Anti-patrones a rechazar en revisión de código

- Lógica de negocio (cálculos, reglas, validaciones más allá de tipo/formato) dentro del controlador o route handler.
- Un servicio de Ventas que importa directamente el modelo de datos de otro módulo para saltarse su capa de servicio.
- Respuestas de error que exponen el mensaje crudo de la base de datos o un stack trace al cliente.
- Códigos de estado HTTP inconsistentes para el mismo tipo de error entre distintos endpoints.
