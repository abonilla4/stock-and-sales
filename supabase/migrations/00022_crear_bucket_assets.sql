-- ============================================================
-- Migración 00022: Crear bucket público "assets" en Supabase Storage
-- ============================================================

-- 1. Insertar bucket assets con public = true si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assets', 'assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Política para permitir lectura pública anónima de objetos en assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Acceso publico de lectura en bucket assets'
  ) THEN
    CREATE POLICY "Acceso publico de lectura en bucket assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'assets');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
