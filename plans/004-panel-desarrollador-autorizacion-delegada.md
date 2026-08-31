# 004 — Panel de Desarrollador y Autorización Delegada

- **Status**: PENDIENTE — plan para ejecutar en Antigravity / Claude Code
- **Depende de**: Bloque 1 aplicado y verificado en dev (migraciones
  00025–00028 — ver nota de renumeración abajo)

> **Nota de renumeración (2026-08-30):** este plan y las migraciones del
> Bloque 1 se redactaron originalmente como `00023`–`00026`. La numeración
> avanzó en paralelo por la actualización de Presupuestos, así que los
> archivos reales quedaron como `00025_rol_desarrollador_enum.sql`,
> `00026_tablas_permisos.sql`, `00027_funciones_permisos.sql` y
> `00028_blindaje_roles_y_rpcs.sql`. El contenido SQL es idéntico; solo
> cambió el prefijo. **Las migraciones futuras de este plan (Fases 3 y 4)
> NO deben asumir `00029`/`00030` como números fijos** — antes de crear
> cada archivo nuevo, correr `ls supabase/migrations/ | tail -3` para
> tomar el siguiente número libre real.
- **Bloquea**: la migración de reescritura de RLS (Fase 5, número por
  asignar — ver nota de renumeración). No se inicia hasta cerrar
  este plan completo y con evidencia real de Supabase Cloud.
- **Repo**: stock-and-sales · rama develop

## Gate de entrada (no arrancar sin esto)

Antes de tocar código, confirmar en el proyecto de dev:

```sql
SELECT rol, count(*) FROM rol_permisos GROUP BY rol ORDER BY rol;
SELECT grantee, privilege_type FROM information_schema.table_privileges
 WHERE table_name = 'profiles';
```

Y confirmar que existe al menos un usuario con `role = 'desarrollador'`
(paso manual documentado al final de `00028_blindaje_roles_y_rpcs.sql`).
Si falta, ejecutarlo primero — nada de este plan funciona sin un ancla
`desarrollador`.

## Por qué este orden y no otro

Dos cosas condicionan la secuencia:

1. **`admin.ts` (Service Role) es un recurso compartido.** Lo necesita tanto
   "crear/desactivar usuario" (Fase 3) como el cliente efímero de la
   autorización delegada (Fase 4). Construirlo una sola vez en la Fase 1
   evita hacerlo dos veces con criterios distintos.
2. **El panel de bajo riesgo se construye antes que la gestión de usuarios.**
   Auditoría, matriz de permisos y cola de revisión son de solo lectura o
   ejercitan RPCs que ya existen desde el Bloque 1 (`tiene_permiso`,
   `asignar_permiso`). Sirven como prueba de humo del kernel de permisos
   sin ningún riesgo de romper una venta real.
3. **La reescritura de RLS (fuera de este plan, número de migración por
   asignar cuando llegue el momento — ver nota de renumeración) se hace al final,
   con un cajero real de prueba creado a través del propio panel que este
   plan construye.** Es decir: usamos el panel para crear el usuario que
   luego usamos para validar que el panel — y el resto del sistema — le
   niega correctamente los permisos que no debe tener.

## Fase 1 — Infraestructura compartida

### 1.1 Cliente Supabase administrativo

**Archivo nuevo:** `src/lib/supabase/admin.ts`

```ts
import "server-only"; // primera línea — el build debe fallar si esto se importa desde un client component
```

Expone dos funciones:
- `createAdminClient()` — Service Role Key. Uso exclusivo: `auth.admin.*`
  (crear, banear, resetear password). Nunca para queries de negocio.
- `createEphemeralClient()` — anon key, `persistSession: false,
  autoRefreshToken: false`. Uso exclusivo: validar credenciales de un
  usuario que no es el de la sesión, sin tocar sus cookies.

**Variable de entorno:** `SUPABASE_SERVICE_ROLE_KEY` en Vercel, **sin**
prefijo `NEXT_PUBLIC_`, marcada solo para Runtime (no Build, no Preview
del navegador).

**Verificación de esta sub-fase:**
```bash
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/ # debe devolver 0 resultados tras build
```
Confirmar que un intento de import desde un `"use client"` component
rompe el build (probar deliberadamente y revertir).

### 1.2 Protección de rutas `/dashboard/sistema`

**Archivo nuevo:** `src/app/dashboard/sistema/layout.tsx`

Server Component. Verifica `tiene_permiso('sistema.gestionar_usuarios')`
o el permiso específico de cada sub-ruta contra la RPC (no contra
`role === 'admin'` hardcodeado). Si falla, `redirect()` al dashboard
principal. Esto es lo que impide el patrón que ya existe hoy en
`sidebar.tsx:104` (ocultar el menú no protege la ruta).

**Verificación:** con sesión de un usuario `cajero` de prueba, navegar
directo a `/dashboard/sistema/auditoria` por URL y confirmar redirect.

**Gate antes de Fase 2:** 1.1 y 1.2 mergeados a `develop`, Preview
Deployment revisado.

---

## Fase 2 — Panel de bajo riesgo (no requiere `admin.ts`)

Construir en cualquier orden entre sí; los tres solo dependen de RPCs
que ya existen desde el Bloque 1.

### 2.1 Auditoría — `/dashboard/sistema/auditoria`
Lectura filtrable de `registro_auditoria` (usuario, acción, fecha).
Solo `SELECT`, sin RPC nueva.

### 2.2 Matriz de permisos — `/dashboard/sistema/permisos`
Grid `rol × permiso` agrupado por `grupo` (tabla `permisos`). Cada
checkbox llama `asignar_permiso(rol, codigo, activo)`. Los permisos
`es_critico = true` se muestran deshabilitados para los roles que el
kernel de la RPC rechaza — es cortesía visual; la RPC ya rechaza aunque
alguien manipule la petición.

**Verificación con intención de fallo (la más importante de esta
sub-fase):** desde la UI, intentar otorgar `ventas.autorizar_stock_negativo`
a `cajero`. Debe fallar con el mensaje del kernel. Si esto pasa, no
seguir — revisar la migración 00026 antes de continuar.

### 2.3 Cola de revisión offline — `/dashboard/sistema/revision`
`SELECT * FROM ventas WHERE origen_autorizacion = 'offline_diferido' AND
autorizado_por IS NULL`. Acción del admin: marcar como revisada
(confirmar o señalar irregular). Esta tabla de datos ya existe desde la
migración 00011 — es deuda visible que se cierra aquí.

**Gate antes de Fase 3:** las tres piezas mergeadas y probadas con un
usuario `desarrollador` real en dev.

---

## Fase 3 — Gestión de usuarios (requiere `admin.ts` de la Fase 1)

### 3.1 Migración `000XX_listar_usuarios.sql` (número real: siguiente libre)

RPC `listar_usuarios()` `SECURITY DEFINER`, valida
`es_desarrollador()`, hace el join `profiles` + `auth.users` (email,
`last_sign_in_at`, `banned_until`). `auth.users` no se expone por RLS
directo — solo a través de esta RPC.

### 3.2 UI — `/dashboard/sistema/usuarios`

- **Listar:** `listar_usuarios()`.
- **Crear:** `admin.ts` → `auth.admin.createUser({ email_confirm: true
  })`. El trigger crea el profile (hoy con default `'admin'`, cambia a
  `'cajero'` en la Fase 5 — ver nota abajo). Si el rol deseado no es el
  default, llamar `asignar_rol` inmediatamente después.
- **Cambiar rol:** `asignar_rol(usuario_id, rol)` — ya existe desde
  00026, aquí solo se conecta a UI.
- **Desactivar:** `admin.ts` → `auth.admin.updateUserById(id, {
  ban_duration: '876000h' })`. No usar una columna `activo` en `profiles`
  como mecanismo principal — un usuario "inactivo" solo por columna sigue
  pudiendo autenticarse y obtener JWT válido.

**Nota temporal:** hasta que la Fase 5 aplique su migración del trigger
(número por asignar), el trigger sigue creando usuarios como `'admin'`
por defecto. Esto es
aceptable dentro de este plan porque el flujo de creación siempre asigna
el rol explícito inmediatamente después vía `asignar_rol`. No dejar
usuarios de prueba sin ese segundo paso.

**Verificación:** crear un usuario de prueba `cajero-test@...` desde el
panel, confirmar en `listar_usuarios()` que aparece con el rol correcto,
y guardar sus credenciales — se reutiliza en la Fase 4 y en la futura
Fase 5.

**Gate antes de Fase 4:** usuario `cajero` de prueba creado y funcional
(puede iniciar sesión, ve el POS, no ve `/dashboard/sistema`).

---

## Fase 4 — Autorización delegada

### 4.1 Migración `000XX_rate_limit_bidimensional.sql` (número real: siguiente libre)

RPC `verificar_y_registrar_intento_autorizacion(p_solicitante_id uuid,
p_email_autorizador text, p_permiso text, p_exito boolean)`. Dos
`pg_advisory_xact_lock` — **tomar siempre en el mismo orden** (primero
`hashtext(p_email_autorizador)`, luego `hashtext(p_solicitante_id::text)`)
para no generar deadlocks bajo concurrencia. Bloquea si cualquiera de los
dos ejes supera 5 intentos fallidos en 5 minutos.

### 4.2 Helper — `src/lib/auth/autorizacion.ts`

```ts
autorizarAccion({ permisoRequerido, credenciales: { email, password } })
  → { ok, autorizadoPor, error }
```
Secuencia: identidad del solicitante desde cookies → `createEphemeralClient()`
valida credenciales → `tiene_permiso_para(adminId, permiso)` →
`verificar_y_registrar_intento_autorizacion` → auditoría → descarta el
cliente efímero. **No ejecuta la acción de negocio** — solo devuelve
`autorizadoPor`. Quien llama ejecuta la RPC de negocio en la misma
server action, sin token intermedio.

### 4.3 Refactor de `autorizarVentaAdmin` y `AdminAuthDialog`

**`src/app/dashboard/pos/actions.ts`** (líneas ~160–210): eliminar la
validación de que el usuario en sesión ya sea admin — ese es el bug que
impide que un cajero pida autorización hoy. Cambiar firma para recibir
`email` + `password`, llamar `autorizarAccion(...)`.

**`src/components/pos/admin-auth-dialog.tsx`**: agregar campo de email
junto al de password (hoy solo tiene password, confirmado en el
componente actual).

### 4.4 Verificación E2E real (obligatoria, evidencia concreta)

Con el `cajero-test` de la Fase 3 y un `admin` real de dev, en Supabase
Cloud — no en local:
1. Cajero intenta vender con stock insuficiente → bloqueado.
2. Cajero abre el diálogo, ingresa email+password del **admin** (no los
   suyos) → venta se completa.
3. Confirmar en `ventas.autorizado_por` que quedó el id del admin, no del
   cajero.
4. Confirmar en `registro_auditoria` el evento.
5. Confirmar que la sesión del cajero sigue siendo de cajero después del
   flujo (`auth.uid()` no cambió) — este es el bug que originó todo el
   rediseño del punto 2.2, no se puede saltar.
6. Provocar 6 intentos fallidos con contraseña incorrecta del admin →
   confirmar bloqueo por rate limit.

**Gate de cierre del plan:** los 6 puntos de 4.4 verificados con captura
o log real de Supabase Cloud. Sin esto no se solicita autorización de
merge a `main`.

---

## Fuera de este plan (Fase 5, plan aparte, no iniciar todavía)

- Trigger `handle_new_user()` → default `'cajero'` (número de migración:
  tomar el siguiente libre en `supabase/migrations/` al momento de
  escribirla, no asumir uno de antemano).
- Reescritura de políticas RLS de todas las tablas de negocio usando
  `tiene_permiso(...)` (mismo criterio de numeración) — **la migración de
  mayor riesgo del proyecto**, requiere su propio plan con migración de
  rollback escrita antes de aplicar y pruebas con los tres roles reales.
- Enforcement en UI: reemplazar `role !== "admin"` en `sidebar.tsx:104`
  por permisos vía `mis_permisos()`.

No iniciar la Fase 5 sin autorización explícita, según la regla de
ramas ya establecida en `agents.md`.
