-- ============================================================
-- Migración 00024: Catálogo de permisos y asignación por rol
--
-- 1. Tabla `permisos`      → catálogo FIJO. Se siembra aquí y solo cambia
--                            por migración. No editable desde la aplicación.
-- 2. Tabla `rol_permisos`  → parte CONFIGURABLE. Qué permisos tiene cada rol.
--                            Solo modificable vía RPC asignar_permiso (00026).
--
-- Ninguna de las dos tablas tiene política RLS de escritura: los cambios
-- pasan obligatoriamente por funciones SECURITY DEFINER con validación.
--
-- Requiere: 00023 aplicada previamente (valor 'desarrollador' del enum).
-- ============================================================

-- =========================
-- 1. TABLA permisos (catálogo)
-- =========================

CREATE TABLE IF NOT EXISTS public.permisos (
  codigo       text PRIMARY KEY,
  descripcion  text NOT NULL,
  grupo        text NOT NULL,
  es_critico   boolean NOT NULL DEFAULT false,
  orden        integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.permisos IS
  'Catálogo fijo de permisos. Se modifica solo por migración, nunca desde la app.';
COMMENT ON COLUMN public.permisos.es_critico IS
  'Si es true, la RPC asignar_permiso restringe a qué roles puede otorgarse (kernel de seguridad).';

ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;

-- Lectura para cualquier autenticado: el panel necesita listar el catálogo.
-- No se crea política de INSERT/UPDATE/DELETE a propósito.
DROP POLICY IF EXISTS "Authenticated can select permisos" ON public.permisos;
CREATE POLICY "Authenticated can select permisos"
  ON public.permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);

REVOKE INSERT, UPDATE, DELETE ON public.permisos FROM authenticated, anon, public;
GRANT SELECT ON public.permisos TO authenticated;

-- =========================
-- 2. TABLA rol_permisos (configurable)
-- =========================

CREATE TABLE IF NOT EXISTS public.rol_permisos (
  rol             public.rol_usuario NOT NULL,
  permiso_codigo  text NOT NULL REFERENCES public.permisos(codigo) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rol, permiso_codigo)
);

COMMENT ON TABLE public.rol_permisos IS
  'Permisos efectivos por rol. Solo modificable vía RPC asignar_permiso.';

ALTER TABLE public.rol_permisos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can select rol_permisos" ON public.rol_permisos;
CREATE POLICY "Authenticated can select rol_permisos"
  ON public.rol_permisos FOR SELECT
  USING (auth.uid() IS NOT NULL);

REVOKE INSERT, UPDATE, DELETE ON public.rol_permisos FROM authenticated, anon, public;
GRANT SELECT ON public.rol_permisos TO authenticated;

CREATE INDEX IF NOT EXISTS idx_rol_permisos_rol
  ON public.rol_permisos (rol);

-- =========================
-- 3. SEED DEL CATÁLOGO
-- =========================

INSERT INTO public.permisos (codigo, descripcion, grupo, es_critico, orden) VALUES
  -- INVENTARIO
  ('productos.ver',              'Ver catálogo de productos y stock',        'Inventario',  false, 10),
  ('productos.crear',            'Crear productos nuevos',                    'Inventario',  false, 11),
  ('productos.editar',           'Editar productos existentes',               'Inventario',  false, 12),
  ('productos.eliminar',         'Eliminar o desactivar productos',           'Inventario',  false, 13),
  ('productos.ver_costo',        'Ver precio de costo de los productos',      'Inventario',  false, 14),
  ('inventario.ajustar',         'Ajustar stock manualmente',                 'Inventario',  false, 15),
  ('inventario.ver_movimientos', 'Consultar historial de movimientos',        'Inventario',  false, 16),

  -- VENTAS
  ('ventas.crear',                       'Registrar ventas en el POS',                'Ventas', false, 20),
  ('ventas.ver_propias',                 'Ver únicamente las ventas propias',         'Ventas', false, 21),
  ('ventas.ver_todas',                   'Ver las ventas de todos los usuarios',      'Ventas', false, 22),
  ('ventas.anular',                      'Anular una venta ya confirmada',            'Ventas', true,  23),
  ('ventas.autorizar_stock_negativo',    'Autorizar venta con stock insuficiente',    'Ventas', true,  24),
  ('ventas.autorizar_descuento',         'Autorizar descuento superior al límite',    'Ventas', true,  25),

  -- CLIENTES Y FIADO
  ('clientes.ver',           'Ver clientes registrados',            'Clientes', false, 30),
  ('clientes.crear',         'Registrar clientes nuevos',           'Clientes', false, 31),
  ('clientes.editar',        'Editar datos de clientes',            'Clientes', false, 32),
  ('fiado.ver_saldos',       'Consultar saldos de fiado',           'Clientes', false, 33),
  ('fiado.registrar_abono',  'Registrar abonos a cuentas de fiado', 'Clientes', false, 34),

  -- PROVEEDORES
  ('proveedores.ver',     'Ver proveedores',            'Proveedores', false, 40),
  ('proveedores.crear',   'Registrar proveedores',      'Proveedores', false, 41),
  ('proveedores.editar',  'Editar proveedores',         'Proveedores', false, 42),

  -- REPORTES
  ('reportes.ver_basicos',     'Ver reportes operativos',                  'Reportes', false, 50),
  ('reportes.ver_financieros', 'Ver reportes de margen y utilidad',        'Reportes', false, 51),

  -- SISTEMA
  ('config.editar',              'Editar configuración del negocio',       'Sistema', false, 60),
  ('sistema.ver_auditoria',      'Consultar el registro de auditoría',     'Sistema', false, 61),
  ('sistema.gestionar_usuarios', 'Crear, desactivar y resetear usuarios',  'Sistema', true,  62),
  ('sistema.asignar_roles',      'Asignar roles y configurar permisos',    'Sistema', true,  63)
ON CONFLICT (codigo) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      grupo       = EXCLUDED.grupo,
      es_critico  = EXCLUDED.es_critico,
      orden       = EXCLUDED.orden;

-- =========================
-- 4. ASIGNACIONES POR DEFECTO
-- =========================

-- 4.1 desarrollador: TODOS los permisos, sin excepción.
INSERT INTO public.rol_permisos (rol, permiso_codigo)
SELECT 'desarrollador', codigo FROM public.permisos
ON CONFLICT DO NOTHING;

-- 4.2 admin: todo lo operativo. Se excluyen los permisos de gestión de
--     usuarios y roles: eso es exclusivo del desarrollador (proveedor del
--     servicio), para que el cliente no pueda crear usuarios fantasma ni
--     alterar la trazabilidad de las autorizaciones.
INSERT INTO public.rol_permisos (rol, permiso_codigo)
SELECT 'admin', codigo
  FROM public.permisos
 WHERE codigo NOT IN ('sistema.gestionar_usuarios', 'sistema.asignar_roles')
ON CONFLICT DO NOTHING;

-- 4.3 cajero: mínimo indispensable para operar el mostrador.
--     Sin ver_costo, sin editar productos, sin anular, sin autorizar.
INSERT INTO public.rol_permisos (rol, permiso_codigo)
SELECT 'cajero', codigo
  FROM public.permisos
 WHERE codigo IN (
   'productos.ver',
   'ventas.crear',
   'ventas.ver_propias',
   'clientes.ver',
   'clientes.crear',
   'clientes.editar',
   'fiado.ver_saldos',
   'fiado.registrar_abono',
   'proveedores.ver'
 )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
