<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Stock&Sales

Fuente única de reglas para cualquier agente de código que trabaje en este
repositorio. Es tool-agnostic a propósito: no contiene sintaxis ni instrucciones
específicas de ninguna herramienta. Las adaptaciones por herramienta viven en
archivos aparte que importan este.

## Contexto del producto

Stock&Sales es un SaaS de inventario y ventas para comercio minorista venezolano
(ferreterías, repuestos, víveres, refrigeración).

Stack: Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, RLS,
Realtime) + Vercel.

Despliegues activos — **un solo repositorio compartido, un proyecto de Vercel por
cliente**:

| Cliente | Entorno |
|---|---|
| Ferretería piloto | Desarrollo y pruebas |
| Repuestos Tokyo | Producción |
| Refrigeración Yireh | Producción |

La resiliencia offline es una restricción de diseño real: la conectividad del
cliente final es intermitente. **Esto nunca se resuelve escribiendo en tablas de
negocio fuera de la RPC central** — ver "Integridad de datos y stock" más abajo.
Si crees que una funcionalidad offline exige romper esa regla, detente y
pregúntame; la respuesta no es un camino alterno.

## Documentación de referencia

Lee bajo demanda el documento que corresponda a la tarea. **No los leas todos por
defecto**: cargarlos completos en cada sesión degrada tu adherencia al resto de
estas reglas.

| Documento | Cuándo leerlo |
|---|---|
| `.agents/Docs/01-PRD.md` | Alcance, requisitos de producto, decisiones de negocio |
| `.agents/Docs/02-TRD.md` | Decisiones técnicas y justificación de arquitectura |
| `.agents/Docs/03-Flujo-App.md` | Flujos de usuario y navegación |
| `.agents/Docs/04-UIUX-Brief.md` | Solo para trabajo de interfaz |
| `.agents/Docs/05-Esquema-Backend.md` | **Obligatorio** antes de tocar `supabase/`, escribir SQL o modificar cualquier query |
| `.agents/Docs/06-Plan-Implementacion.md` | **Obligatorio** al abrir o cerrar una fase |
| `.agents/Docs/08-Estrategia-Multi-Rubro.md` | Configuración o adaptación por rubro de cliente |
| `.agents/Docs/09-Plan-Remediacion.md` | Trabajo de remediación de seguridad en curso |
| `.agents/Docs/10-Auditoria-Seguridad.md` | Postura de seguridad y hallazgos abiertos |

## Reglas no negociables

### Integridad de datos y stock

- Sigue exactamente el esquema de `.agents/Docs/05-Esquema-Backend.md`. No lo
  modifiques sin confirmar conmigo primero.
- RLS habilitado en cada tabla de Supabase desde el primer commit.
- Toda modificación de stock (venta/ajuste/anulación) pasa por una única función
  centralizada, dentro de una transacción atómica — nunca un UPDATE disperso en
  el código.
- **NUNCA implementes un camino alterno** (fallback, retry, modo degradado) que
  modifique `stock_actual`, `ventas` o cualquier tabla de negocio fuera de la
  función centralizada `procesar_venta_transaccion`, bajo ninguna circunstancia,
  incluyendo fallas de red o de sincronización con Supabase Cloud. Si detectas
  que necesitas algo así, DETENTE y pregúntame — no lo implementes.
- Cualquier campo que represente un saldo o cantidad crítica (`stock_actual`,
  `saldo_fiado`, etc.) se modifica EXCLUSIVAMENTE mediante una RPC atómica
  dedicada — nunca mediante SELECT + UPDATE separados desde el servidor. Si no
  existe la RPC, créala antes de escribir la lógica de negocio.
- No existen fallbacks en Server Actions: si la RPC falla, se retorna el error
  directamente al cliente. No se implementan caminos alternos que modifiquen
  tablas de negocio.
- El precio se congela en `detalle_venta` al momento de la venta; nunca se
  recalcula contra el precio actual del producto.
- El precio se recalcula siempre en el servidor. Un precio enviado por el
  cliente es un dato no confiable, jamás una fuente de verdad.
- La tasa de cambio se guarda como snapshot en cada venta
  (`tasa_cambio_aplicada`); nunca se recalcula después.
- El folio de venta se asigna solo después del COMMIT exitoso, nunca antes.
- Toda autorización de excepción (venta con stock insuficiente) queda registrada
  con usuario y timestamp (`autorizado_por`) — es un evento auditable.

### Arquitectura multi-cliente

- **NUNCA forkees ni clones este repositorio para un cliente nuevo.** La
  arquitectura correcta es repositorio único compartido + un proyecto de Vercel
  por cliente. Si una necesidad parece exigir un fork, es una señal de que la
  configuración debe volverse parametrizable, no de que el repo deba dividirse.
- La identidad del cliente se lee **exclusivamente** de variables de entorno
  `NEXT_PUBLIC_NEGOCIO_*`, con valores por defecto neutros.
- Nunca hardcodees el nombre, logo, RIF, dirección ni ningún dato de un cliente
  en el código. Un dato hardcodeado aparece en el despliegue de todos los demás.

### Autorización y roles

- El modelo de roles **está incompleto**. No asumas que funciona:
  - `profiles` define los roles `admin` y `cajero`, pero el trigger de alta
    asigna `admin` a todo usuario nuevo.
  - Las policies de RLS otorgan permisos idénticos a cualquier usuario
    autenticado; no distinguen rol.
  - El flujo de autorización administrativa hace re-autenticación del usuario
    actual, no autorización delegada desde un administrador distinto.
- Antes de escribir código que dependa del rol, verifica el estado real en la
  base de datos. Si tu cambio necesita RBAC funcional, díme lo que falta en vez
  de construir sobre la suposición de que ya existe.

### Migraciones y verificación

- Las migraciones numeradas en `supabase/migrations/` son la **fuente de verdad**
  de la postura de seguridad. Un cambio hecho a mano en el dashboard de Supabase
  que no esté formalizado como migración no es un cambio terminado: es deuda.
- `supabase db push` sobre un proyecto nuevo debe reproducir la configuración
  completa — RLS, policies, GRANT/REVOKE, triggers y funciones — sin ningún paso
  manual.
- **Verificación basada en evidencia.** "El build pasó", "compiló" o "la lógica
  es correcta" no cierran nada. Un cambio crítico se cierra con evidencia de
  ejecución antes/después obtenida contra Supabase Cloud. El análisis estático y
  las confirmaciones declarativas no son prueba.

## Flujo de trabajo

- Trabajamos el Plan de Implementación (`06`) fase por fase. No adelantes fases
  futuras sin que te lo pida explícitamente.
- Antes de escribir código en una fase nueva, presenta el plan o checklist de
  esa fase y **espera mi aprobación explícita** antes de ejecutar nada.
- Al cerrar una fase, verifícala contra su "DoD" en
  `.agents/Docs/06-Plan-Implementacion.md`.
- Si algo en el código ya construido no coincide con estas reglas, **dímelo
  explícitamente en vez de corregirlo en silencio**. Un arreglo silencioso me
  quita la información de que la regla se rompió.

## Estrategia de ramas (clientes reales en producción)

- NUNCA hagas commit ni push directo a la rama `main`.
- Todo cambio se desarrolla en `develop`, o en una rama de feature creada desde
  `develop`.
- Después de cada cambio, indícame que revise el Preview Deployment de Vercel
  antes de aprobar el merge. La URL la obtengo yo desde el check de GitHub en el
  PR; no intentes obtenerla ejecutando la CLI de Vercel.
- Solo mergeas `develop` → `main` cuando yo te lo confirme explícitamente y por
  escrito.
- El merge a `main` dispara el deploy de producción para TODOS los clientes
  simultáneamente — trátalo como una acción irreversible que afecta negocios
  reales, no como un paso más del flujo.

## Infraestructura de terceros (Vercel, Supabase)

Nunca modifiques configuración de seguridad, protección de acceso, o cualquier
ajuste de infraestructura en Vercel o Supabase para sortear un bloqueo que
encuentres durante una verificación automatizada. Si un script o herramienta
choca con una protección de acceso, detente y consulta antes de continuar — no
cambies la protección para que el script pase.

Esto incluye, sin limitarse a: protección SSO de Vercel, políticas de RLS,
variables de entorno de producción, claves de API y configuración de Auth.

### Ejecución contra Supabase Cloud

- **No ejecutes SQL ni invoques RPCs contra Supabase Cloud por tu cuenta**, ni
  para escribir ni para leer. Cuando necesites un dato de Cloud para decidir el
  siguiente paso, o cuando una fase exija evidencia de ejecución, pásame la
  consulta o la RPC exacta que hay que correr: yo la ejecuto en el SQL Editor y
  te devuelvo el resultado.
- La introspección de solo lectura del catálogo —listar tablas, columnas,
  políticas, migraciones aplicadas, advisories— no cuenta como ejecución de SQL
  y puedes consultarla libremente. El límite es el dato: en cuanto necesites
  ejecutar una consulta sobre datos reales de negocio, o cualquier escritura,
  sin excepción me la pasas primero.
- Esto **no** relaja la verificación basada en evidencia: un cambio crítico se
  sigue cerrando con salida real de ejecución, solo que quien la ejecuta soy yo.
  Dar por bueno un resultado que nadie corrió sigue siendo inaceptable, y
  predecir la salida de una consulta no es haberla corrido.
- **Un bloqueo aplica a la acción, no al nombre literal de la herramienta.** Si
  una acción está vedada por la configuración de permisos, sigue vedada aunque
  aparezca disponible bajo otro nombre, otro alias, otro servidor o cualquier
  mecanismo distinto que haga lo mismo. Encontrar una vía alterna no es una
  autorización: es exactamente el caso en el que debes detenerte y preguntarme.

### Operaciones sobre GitHub

- Puedes leer libremente el estado del repositorio remoto: listar y ver PRs,
  issues, checks y sus resultados. Es el equivalente a la introspección de
  catálogo en Supabase.
- **No cierres ni mergees un Pull Request.** Mergear un PR hacia `main` dispara
  el deploy de producción de todos los clientes; cerrarlo descarta trabajo. Las
  dos son decisiones mías, no tuyas, y valen aunque yo te haya pedido "termina
  el PR": terminar significa dejarlo listo para que yo lo revise.
- **No apruebes ni pidas cambios en un PR.** Una revisión queda asentada como
  juicio de registro, y que apruebe el mismo que escribió el código vacía de
  sentido la revisión sobre la que yo decido el merge.
- **No edites los metadatos de un PR.** Cambiar la rama base retargetea un PR de
  `develop` a `main`, que es el mismo camino irreversible del punto anterior por
  otra puerta.
- **No borres repositorios, no dispares workflows y no publiques releases.** Un
  workflow puede desplegar; una release es un anuncio público. Ninguna de las
  tres se deshace.
- **No invoques la API cruda de GitHub.** Los comandos de alto nivel expresan su
  intención en el nombre y por eso se pueden bloquear con precisión; una llamada
  directa a la API oculta el verbo entre los argumentos y vuelve inútil
  cualquier bloqueo. Si necesitas algo que solo se consigue por la API, pídemelo.
- Abrir un PR y comentar sí puedes, cuando te lo pida. Son acciones hacia afuera:
  no las hagas por iniciativa propia.
