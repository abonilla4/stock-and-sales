-- ============================================================
-- Migración 00032: Blindaje de registro_auditoria
--
-- CIERRA LA BRECHA de la migración 00017, que creó la tabla con una sola
-- política:
--
--     CREATE POLICY "Authenticated users can select/insert audit logs"
--       ON public.registro_auditoria FOR ALL
--       USING (auth.uid() IS NOT NULL);
--
-- `FOR ALL` sin `WITH CHECK` hace que PostgreSQL reutilice el `USING` como
-- `WITH CHECK`, de modo que cualquier usuario autenticado podía no solo LEER
-- la auditoría completa, sino INSERTAR filas falsas y —lo grave— BORRAR las
-- suyas. Un cajero podía eliminar el rastro de sus propios intentos fallidos
-- de autorización, que es justo lo que esta tabla existe para impedir.
--
-- Postura resultante, mismo patrón que la 00028:
--   1. Ninguna política de escritura. La única política es de SELECT.
--   2. REVOKE de INSERT/UPDATE/DELETE/TRUNCATE a nivel de tabla.
--   3. La escritura ocurre solo desde funciones SECURITY DEFINER (propiedad
--      del owner, no sujetas a RLS ni a estos GRANT) y desde el servidor con
--      la Service Role Key.
--
-- ESTA MIGRACIÓN FORMALIZA UN CAMBIO YA APLICADO A MANO en dev, Tokyo y Yireh.
-- Su contenido está verificado contra los tres proyectos:
--   • information_schema.table_privileges: sobre registro_auditoria solo quedan
--     SELECT, REFERENCES y TRIGGER.
--   • pg_policies: una sola política, "Authenticated can select audit logs",
--     cmd = SELECT, qual = (auth.uid() IS NOT NULL), with_check = null.
-- El archivo reproduce ese estado tal cual. No hay nada que ejecutar: se marca
-- como aplicada con `supabase migration repair`.
--
-- POR QUÉ LA LECTURA SIGUE ABIERTA A CUALQUIER AUTENTICADO
-- La política natural aquí sería exigir tiene_permiso('sistema.ver_auditoria'),
-- para que proteger el dato y ocultar la pantalla dejen de ser dos cosas
-- distintas. No se hace, y no es una postergación por criterio: `tiene_permiso`
-- la crea la migración 00027, que **no está desplegada en Tokyo ni en Yireh**.
-- Una política que la invoque haría fallar esta migración en esos dos proyectos
-- con "function does not exist". La restricción de lectura queda atada a que el
-- kernel de permisos llegue a producción — ver la nota al pie del archivo.
--
-- Requiere: 00017 (tabla). Deliberadamente NO depende de la 00027, para poder
-- aplicarse en proyectos que aún no tienen el kernel de permisos.
-- ============================================================

-- =========================
-- 1. LIMPIAR POLÍTICAS EXISTENTES
-- =========================
-- Se dropean TODAS las políticas de la tabla, no dos nombres concretos. En los
-- tres entornos ya existe una política nueva cuyo nombre no está registrado en
-- ninguna migración, así que nombrarla sería adivinar. Este bucle deja la tabla
-- en un estado conocido venga de donde venga: proyecto virgen, proyecto con la
-- política vieja de la 00017, o proyecto ya parchado a mano.

DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'registro_auditoria'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.registro_auditoria',
      v_policy.policyname
    );
  END LOOP;
END $$;

-- =========================
-- 2. RLS Y PRIVILEGIOS DE TABLA
-- =========================

ALTER TABLE public.registro_auditoria ENABLE ROW LEVEL SECURITY;

-- El REVOKE es la mitad que la política no cubre: sin él, un GRANT heredado
-- deja la puerta abierta aunque no exista política de escritura. Supabase
-- otorga ALL sobre las tablas nuevas de `public` a anon y authenticated, así
-- que en un proyecto virgen esta línea es lo único que cierra la escritura.
--
-- TRUNCATE va incluido a propósito: no lo cubre ninguna política de RLS —
-- PostgreSQL no evalúa RLS en TRUNCATE— así que revocar el privilegio es la
-- única forma de impedir que se vacíe la bitácora de un golpe. Sin esta línea,
-- un usuario autenticado podía borrar la auditoría completa aunque no pudiera
-- borrar una fila suelta.
--
-- Estado resultante ya verificado en dev, Tokyo y Yireh contra
-- information_schema.table_privileges: solo quedan SELECT, REFERENCES y TRIGGER.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.registro_auditoria FROM authenticated, anon, public;

GRANT SELECT ON public.registro_auditoria TO authenticated;

-- El servidor escribe con la Service Role Key los eventos que ocurren en Auth y
-- no tienen RPC (alta, baja y reactivación de usuarios). El REVOKE de arriba no
-- nombra a service_role, así que conserva lo que Supabase le otorga por defecto;
-- este GRANT lo deja explícito para que no dependa de ese default.
GRANT INSERT ON public.registro_auditoria TO service_role;

-- =========================
-- 3. ÚNICA POLÍTICA: LECTURA
-- =========================
-- Reemplaza la política `FOR ALL` de la 00017 por una de solo SELECT. El cambio
-- de fondo no está en el USING —que se mantiene igual— sino en el `cmd`: pasar
-- de FOR ALL a FOR SELECT es lo que quita el INSERT, UPDATE y DELETE que la
-- política vieja concedía de rebote.
--
-- El USING sigue siendo `auth.uid() IS NOT NULL` por la restricción de
-- despliegue explicada en el encabezado, no por preferencia.

CREATE POLICY "Authenticated can select audit logs"
  ON public.registro_auditoria FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- No se crean políticas de INSERT, UPDATE ni DELETE a propósito.
--
-- Las funciones que escriben aquí —verificar_y_registrar_intento_admin (00017),
-- asignar_rol y asignar_permiso (00028), revisar_autorizacion_offline (00029)—
-- son SECURITY DEFINER: corren como su dueño, así que ni la RLS ni los REVOKE
-- de arriba las afectan. La aplicación escribe los eventos que ocurren en Auth
-- y no tienen RPC (alta, baja y reactivación de usuarios) con la Service Role
-- Key desde el servidor.

COMMENT ON TABLE public.registro_auditoria IS
  'Bitácora de eventos de seguridad. Lectura para cualquier autenticado (pendiente restringir por permiso); la escritura ocurre solo en RPCs SECURITY DEFINER o vía Service Role.';

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- PENDIENTE — Fase 5
-- ============================================================
-- Restringir SELECT de registro_auditoria a
-- tiene_permiso('sistema.ver_auditoria') — bloqueado hasta que el kernel de
-- Bloque 1 llegue a Tokyo y Yireh. Hoy cualquier autenticado puede leer la
-- tabla completa por API directa, aunque la UI ya lo filtra.
-- ============================================================
