<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Stock&Sales

## Documentación de referencia
Antes de cualquier tarea nueva, si no la has leído en esta sesión, lee:
@.agents/Docs/01-PRD.md
@.agents/Docs/02-TRD.md
@.agents/Docs/03-Flujo-App.md
@.agents/Docs/04-UIUX-Brief.md
@.agents/Docs/05-Esquema-Backend.md
@.agents/Docs/06-Plan-Implementacion.md
@.agents/Docs/08-Estrategia-Multi-Rubro.md

## Reglas no negociables
- Sigue exactamente el esquema de 05-Esquema-Backend.md. No lo modifiques sin
  confirmar conmigo primero.
- RLS habilitado en cada tabla de Supabase desde el primer commit.
- Toda modificación de stock (venta/ajuste/anulación) pasa por una única
  función centralizada, dentro de una transacción atómica — nunca un UPDATE
  disperso en el código.
- NUNCA implementes un camino alterno (fallback, retry, modo degradado) que
  modifique stock_actual, ventas o cualquier tabla de negocio fuera de la
  función centralizada procesar_venta_transaccion, bajo ninguna circunstancia,
  incluyendo fallas de red o de sincronización con Supabase Cloud. Si detectas
  que necesitas algo así, DETENTE y pregúntame — no lo implementes.
- El precio se congela en detalle_venta al momento de la venta; nunca se
  recalcula contra el precio actual del producto.
- La tasa de cambio se guarda como snapshot en cada venta
  (tasa_cambio_aplicada); nunca se recalcula después.
- El folio de venta se asigna solo después del COMMIT exitoso, nunca antes.
- Toda autorización de excepción (venta con stock insuficiente) queda
  registrada con usuario y timestamp (autorizado_por) — es un evento auditable.
- Cualquier campo que represente un saldo o cantidad crítica (stock_actual,
  saldo_fiado, etc.) se modifica EXCLUSIVAMENTE mediante una RPC atómica
  dedicada — nunca mediante SELECT + UPDATE separados desde el servidor.
  Si no existe la RPC, créala antes de escribir la lógica de negocio.
- No existen fallbacks en Server Actions: si la RPC falla, se retorna el
  error directamente al cliente. No se implementan caminos alternos que
  modifiquen tablas de negocio.

## Flujo de trabajo
- Trabajamos el Plan de Implementación (06) fase por fase. No adelantes
  fases futuras sin que te lo pida explícitamente.
- Antes de escribir código en una fase nueva, genera el plan/checklist de
  esta fase como artifact y espera mi aprobación antes de ejecutar.
- Al cerrar una fase, verifícala contra su "DoD" en 06-Plan-Implementacion.md.
- Si algo en el código ya construido no coincide con estas reglas, dímelo
  explícitamente en vez de corregirlo en silencio.

  ## Estrategia de ramas (clientes reales en producción)
- NUNCA hagas commit ni push directo a la rama main.
- Todo cambio se desarrolla en la rama develop (o una rama de feature
  creada desde develop).
- Después de cada cambio, dame la URL del Preview Deployment de Vercel
  para que la revise antes de aprobar el merge.
- Solo mergeas develop → main cuando yo te lo confirme explícitamente.
- El merge a main dispara el deploy de producción para TODOS los
  clientes simultáneamente — trátalo como una acción irreversible que
  afecta negocios reales, no como un paso más del flujo.