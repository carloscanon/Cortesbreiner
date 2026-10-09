-- =========================================================================
-- SCRIPT SQL: TABLA DE CAMBIOS Y DEVOLUCIONES POS (pos_exchanges)
-- =========================================================================

CREATE TABLE IF NOT EXISTS pos_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  session_id UUID,
  original_sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
  original_consecutive TEXT,
  client_name TEXT NOT NULL DEFAULT 'Cliente General',
  client_document TEXT,
  client_phone TEXT,
  vendedor TEXT,
  returned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  credit_amount NUMERIC NOT NULL DEFAULT 0,
  new_total NUMERIC NOT NULL DEFAULT 0,
  surplus_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_details JSONB,
  reason TEXT DEFAULT 'Cambio de Prenda',
  defect_condition TEXT DEFAULT 'Perfecto Estado',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS y Permisos
ALTER TABLE pos_exchanges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_exchanges' AND policyname = 'allow_all_pos_exchanges') THEN
    CREATE POLICY allow_all_pos_exchanges ON pos_exchanges FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_exchanges' AND policyname = 'allow_anon_pos_exchanges') THEN
    CREATE POLICY allow_anon_pos_exchanges ON pos_exchanges FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON pos_exchanges TO authenticated;
GRANT ALL ON pos_exchanges TO anon;
