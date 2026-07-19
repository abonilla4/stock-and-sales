---
name: frontend-desarrollo
description: Convenciones de frontend de este proyecto — qué datos ocultar según el rol del usuario, por qué la validación de solo-cliente nunca es suficiente, y patrones de UI para catálogo, carrito y checkout. Usa este skill siempre que se trabaje en componentes de React relacionados con catálogo de productos, carrito de venta, checkout, dashboard, o cualquier vista cuyo contenido dependa del rol Administrador/Cajero.
---

# Frontend: permisos y UX de ventas/stock

## Ocultar en UI no es seguridad, es UX

Todo lo que ocultes o deshabilites en el frontend según el rol del usuario (botones, campos, secciones) es una decisión de experiencia, no de seguridad. La validación real vive en el backend (ver skill `datos-seguridad-api`). Si estás construyendo una vista solo-Administrador, no asumas que ocultar el link es suficiente — verifica que el endpoint detrás también rechace al Cajero.

## Qué ocultar según el rol (referencia rápida)

- **Cajero/Vendedor**: no ve el campo `costo` de un producto (solo `precio_venta`), no ve botones de crear/editar/eliminar producto, no ve "ajustar stock", no ve el botón de anular una venta ya confirmada, y su vista de reportes/dashboard se limita a sus propias ventas o al día en curso.
- **Administrador**: acceso completo a todas las vistas.

Cuando agregues un campo nuevo a la ficha de producto, pregúntate si es información sensible (costo, margen) antes de mostrarlo en una vista accesible al Cajero.

## Carrito y checkout

- El stock **no** se descuenta al agregar algo al carrito — es puramente local/de sesión hasta la confirmación. No implementes lógica de "reservar" stock al agregar al carrito (eso es Fase 2, opcional).
- Si el backend responde que no hay stock suficiente al confirmar, muestra el error y ofrece el flujo de "Solicitar autorización" (requiere credenciales de un Administrador) en vez de bloquear silenciosamente o dejar que el usuario reintente sin contexto.
- Los totales (subtotal, impuestos, total) que se muestran al confirmar deben venir de la respuesta del backend, no recalcularse en el cliente — el backend es la fuente de verdad; el frontend solo formatea para mostrar.
- Trata el stock negativo como un estado válido y visible (por ejemplo, en el dashboard o en la ficha de un producto "pendiente de reposición"), no como un error de UI que hay que esconder o que rompe un componente.

## Validación en formularios

Es válido usar validación en el cliente (por ejemplo, React Hook Form con un resolver de Zod) para dar feedback inmediato — pero esto es exclusivamente UX. Nunca trates una validación que solo existe en el cliente como suficiente; el mismo esquema (o uno equivalente) debe validarse en el endpoint del backend correspondiente.

## Anti-patrones a rechazar en revisión de código

- Mostrar `costo` o margen de un producto en cualquier vista alcanzable por un Cajero.
- Calcular o modificar `subtotal`/`impuestos`/`total` en el cliente antes de enviarlos al backend, en vez de mostrar lo que el backend devuelve.
- Un componente que decide qué renderizar basado en un rol guardado en estado local o `localStorage` sin que ese rol provenga de una respuesta autenticada del backend en la sesión actual.
- Bloquear la visualización de productos con stock negativo en vez de mostrarlos como un estado esperado.

## Complemento recomendado (opcional, fuera de este repo)

Este skill cubre las reglas de negocio y permisos específicas del proyecto — no reglas genéricas de rendimiento o accesibilidad de React. Para eso existe `react-best-practices` de `vercel-labs/agent-skills` (guías de Vercel Engineering, 40+ reglas de rendimiento en React/Next.js) y `web-design-guidelines` del mismo repo (100+ reglas de accesibilidad y UX). Son un buen complemento, no un sustituto de este skill. Instálalos en tu entorno local (no en este sandbox) con:

```
npx skills add vercel-labs/agent-skills@react-best-practices -g -y
npx skills add vercel-labs/agent-skills@web-design-guidelines -g -y
```
