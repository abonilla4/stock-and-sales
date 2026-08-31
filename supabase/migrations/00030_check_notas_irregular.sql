-- ============================================================
-- Migración 00030: Notas obligatorias al marcar una revisión como irregular
--
-- Formaliza como migración un CHECK que ya fue aplicado a mano en el proyecto
-- de desarrollo. Un cambio hecho en el dashboard que no está en un archivo no
-- es un cambio terminado: es deuda, y esta migración la cierra.
--
-- Historia, porque explica el DROP:
--     La constraint aplicada a mano en dev NO era esta. Aquella permitía
--     `notas = ''`: dejaba marcar una venta como irregular con una cadena
--     vacía, que para efectos de auditoría es lo mismo que no explicar nada.
--     Se comparó con pg_get_constraintdef antes de formalizar, se detectó la
--     diferencia, y dev se realineó ejecutando exactamente este archivo.
--
--     De ahí el `DROP CONSTRAINT IF EXISTS`: hace la migración idempotente y
--     capaz de reemplazar una versión previa distinta. Sobre un proyecto
--     nuevo (Tokyo, Yireh) el DROP es un no-op y solo corre el ADD.
--
-- Por qué esta forma y no la obvia:
--   `resultado <> 'irregular' OR btrim(notas) <> ''` parece equivalente pero
--   NO lo es: con notas NULL la segunda mitad evalúa a NULL, no a false, y un
--   CHECK solo rechaza cuando la expresión es false. Es decir, dejaría pasar
--   exactamente el caso que se quiere impedir. La forma de abajo es segura
--   ante NULL y ante cadenas en blanco.
--
-- Requiere: 00029 (tabla revisiones_autorizacion).
-- ============================================================

ALTER TABLE public.revisiones_autorizacion
  DROP CONSTRAINT IF EXISTS notas_requeridas_si_irregular;

ALTER TABLE public.revisiones_autorizacion
  ADD CONSTRAINT notas_requeridas_si_irregular
  CHECK (
    resultado <> 'irregular'
    OR (notas IS NOT NULL AND btrim(notas) <> '')
  );

COMMENT ON CONSTRAINT notas_requeridas_si_irregular ON public.revisiones_autorizacion IS
  'Marcar una venta como irregular sin decir por qué no deja rastro auditable. Confirmarla sí admite notas vacías.';

NOTIFY pgrst, 'reload schema';
