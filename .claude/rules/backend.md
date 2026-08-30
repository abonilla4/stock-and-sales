---
paths:
  - "supabase/**/*.sql"
  - "supabase/migrations/**"
  - "app/**/actions.ts"
  - "app/**/actions/**/*.ts"
  - "lib/supabase/**/*.ts"
---

# Mecánica de backend

Los invariantes de negocio están en `AGENTS.md` y aplican siempre. Esta regla
añade la mecánica que solo importa cuando se trabaja sobre SQL, migraciones o
Server Actions. Si algo aquí parece contradecir `AGENTS.md`, gana `AGENTS.md` y
avísame de la contradicción.

## Antes de escribir

Lee `.agents/Docs/05-Esquema-Backend.md` completo. No infieras el esquema
leyendo tipos generados ni migraciones sueltas: el documento es el contrato.

## Migraciones

- Una migración por cambio lógico, con nombre descriptivo y numeración
  secuencial. Nunca edites una migración ya aplicada en cualquier entorno: para
  corregirla, escribe una migración nueva que la enmiende.
- Toda tabla nueva habilita RLS **en la misma migración que la crea**, nunca en
  una posterior. Una tabla que existe un solo commit sin RLS es una tabla
  expuesta.
- Todo `GRANT`, `REVOKE`, policy, trigger y función va en migración. Si lo
  probaste a mano en el dashboard, no está hecho hasta que esté en un archivo.
- Criterio de aceptación de cualquier migración: `supabase db push` sobre un
  proyecto vacío debe dejarlo en la misma postura que producción, sin pasos
  manuales.

## Columnas con escritura revocada

Estas columnas tienen `REVOKE UPDATE`. No propongas ni escribas `UPDATE` directo
contra ellas — la escritura ocurre solo dentro de la RPC correspondiente:

- `productos.stock_actual`
- `clientes.saldo_fiado`
- `presupuestos.estado`
- `presupuestos.venta_id`

Si necesitas cambiar el valor de una de ellas y no existe una RPC que lo haga,
la tarea es escribir la RPC primero, no relajar el permiso.

## Concurrencia

- Las operaciones que leen y luego escriben una cantidad crítica usan bloqueo
  explícito (`FOR UPDATE`) dentro de la transacción. Un SELECT seguido de un
  UPDATE en dos sentencias es una condición de carrera, aunque estén en la misma
  función.
- La generación de folio es atómica vía secuencia de Postgres. No la reimplementes
  con `MAX(folio) + 1`.
- El rate limiting usa `pg_advisory_xact_lock`, no contadores en tabla.

## Server Actions

- Validación Zod del payload completo **antes** de cualquier contacto con la base
  de datos. Sin excepciones, incluso para acciones internas.
- La Server Action orquesta y traduce errores; la lógica de negocio vive en la
  RPC. Si estás escribiendo reglas de negocio en TypeScript, probablemente están
  en el lugar equivocado.
- Si la RPC devuelve error, propágalo al cliente. No lo captures para intentar
  otra cosa.

## Cierre de un cambio

Un cambio de backend no está terminado hasta que exista evidencia de ejecución
antes/después contra Supabase Cloud. Pega la salida real. "El build pasó" no es
evidencia de nada relacionado con la base de datos.
