-- =========================================================================
-- SCRIPT SQL: ESTRUCTURA PARA HOMOLOGACIÓN Y CONSOLIDACIÓN DE PRODUCTOS TERMINADOS
-- =========================================================================

-- 1. Tabla de Homologaciones de Productos (Código Maestro)
CREATE TABLE IF NOT EXISTS product_homologations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  master_code TEXT NOT NULL,
  source_code TEXT NOT NULL,
  source_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  match_percentage INTEGER DEFAULT 100,
  match_type TEXT DEFAULT 'exacta' CHECK (match_type IN ('exacta', 'probable', 'sin_coincidencia', 'ya_homologado', 'manual')),
  notes TEXT,
  created_by TEXT,
  status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'Revertido')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Historial de Auditoría de Homologaciones
CREATE TABLE IF NOT EXISTS homologation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homologation_id UUID REFERENCES product_homologations(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'CREACION', 'REVERSION', 'CONSOLIDACION_WIZARD', 'IMPORTACION_MASIVA'
  user_email TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar Seguridad RLS y Permisos
ALTER TABLE product_homologations ENABLE ROW LEVEL SECURITY;
ALTER TABLE homologation_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_homologations' AND policyname = 'allow_authenticated') THEN
    CREATE POLICY allow_authenticated ON product_homologations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'homologation_logs' AND policyname = 'allow_authenticated') THEN
    CREATE POLICY allow_authenticated ON homologation_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON product_homologations TO authenticated;
GRANT ALL ON homologation_logs TO authenticated;
GRANT SELECT ON product_homologations TO anon;
GRANT SELECT ON homologation_logs TO anon;
