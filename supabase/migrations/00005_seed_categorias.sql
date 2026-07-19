-- ============================================================
-- Migración 00005: Seed de categorías iniciales
-- 6 categorías del PRD §5: plomería, electricidad, herramientas,
-- pintura, materiales, ferretería general.
-- ============================================================

INSERT INTO categorias (nombre, descripcion) VALUES
  ('Plomería', 'Tubos, conexiones, llaves, válvulas y accesorios de plomería'),
  ('Electricidad', 'Cables, interruptores, tomacorrientes, breakers y material eléctrico'),
  ('Herramientas', 'Herramientas manuales y eléctricas'),
  ('Pintura', 'Pinturas, brochas, rodillos, solventes y accesorios de pintura'),
  ('Materiales', 'Cemento, arena, bloques, cabillas y materiales de construcción'),
  ('Ferretería General', 'Tornillos, clavos, bisagras, cerraduras y artículos generales');
