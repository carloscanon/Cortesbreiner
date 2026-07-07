-- SQL Migration to setup individual_garments and quality_inspections billing columns
-- Copy and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/plsvbuzcjtztpidsjmua/sql

-- Create individual_garments table
CREATE TABLE IF NOT EXISTS individual_garments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sewing_order_id UUID REFERENCES sewing_orders(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  quality_inspection_id UUID REFERENCES quality_inspections(id) ON DELETE SET NULL,
  barcode TEXT UNIQUE NOT NULL,
  reference_name TEXT,
  color_name TEXT,
  size_code TEXT,
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Aprobada', 'Reproceso', 'Rechazada')),
  defect_checklist JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure order_id column exists if table was already created
ALTER TABLE individual_garments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE individual_garments ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'individual_garments' AND policyname = 'allow_authenticated'
  ) THEN
    CREATE POLICY allow_authenticated ON individual_garments
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON individual_garments TO authenticated;
GRANT SELECT ON individual_garments TO anon;

-- Add billing columns to quality_inspections
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_inspections' AND column_name='valor_prenda') THEN
    ALTER TABLE quality_inspections ADD COLUMN valor_prenda NUMERIC DEFAULT 3500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_inspections' AND column_name='descuento_defectos') THEN
    ALTER TABLE quality_inspections ADD COLUMN descuento_defectos NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_inspections' AND column_name='valor_pagar') THEN
    ALTER TABLE quality_inspections ADD COLUMN valor_pagar NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quality_inspections' AND column_name='pago_status') THEN
    ALTER TABLE quality_inspections ADD COLUMN pago_status TEXT DEFAULT 'Pendiente de aprobación financiera';
  END IF;
END $$;

-- Update status check constraint to support Doblado and Empacado
ALTER TABLE quality_inspections DROP CONSTRAINT IF EXISTS quality_inspections_status_check;
ALTER TABLE quality_inspections ADD CONSTRAINT quality_inspections_status_check CHECK (status IN ('Pendiente', 'Aprobado', 'Doblado', 'Empacado', 'Reproceso', 'Rechazado'));

-- Reload PostgREST schema cache to instantly reflect the new columns in the client API
NOTIFY pgrst, 'reload schema';
