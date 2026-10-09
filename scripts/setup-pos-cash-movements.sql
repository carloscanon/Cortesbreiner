-- =========================================================================
-- SCRIPT SQL: CONCEPTOS Y MOVIMIENTOS DE CAJA POS (pos_cash_movements)
-- =========================================================================

CREATE TABLE IF NOT EXISTS pos_cash_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso', 'ambos')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES pos_cash_sessions(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  register_id UUID REFERENCES pos_registers(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  observaciones TEXT,
  usuario TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS y Permisos
ALTER TABLE pos_cash_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_cash_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_cash_concepts' AND policyname = 'allow_all_pos_cash_concepts') THEN
    CREATE POLICY allow_all_pos_cash_concepts ON pos_cash_concepts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_cash_concepts' AND policyname = 'allow_anon_pos_cash_concepts') THEN
    CREATE POLICY allow_anon_pos_cash_concepts ON pos_cash_concepts FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_cash_movements' AND policyname = 'allow_all_pos_cash_movements') THEN
    CREATE POLICY allow_all_pos_cash_movements ON pos_cash_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_cash_movements' AND policyname = 'allow_anon_pos_cash_movements') THEN
    CREATE POLICY allow_anon_pos_cash_movements ON pos_cash_movements FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON pos_cash_concepts TO authenticated;
GRANT ALL ON pos_cash_concepts TO anon;
GRANT ALL ON pos_cash_movements TO authenticated;
GRANT ALL ON pos_cash_movements TO anon;

-- Conceptos iniciales por defecto
INSERT INTO pos_cash_concepts (name, type, description)
VALUES
  ('Pago Parqueaderos', 'egreso', 'Gastos por estacionamiento de clientes o vehículos de la tienda'),
  ('Sencillo / Cambio de Efectivo', 'ambos', 'Entrada o salida de efectivo para dar cambio en caja'),
  ('Aseo y Cafetería', 'egreso', 'Compra de implementos de limpieza, agua, café y refrigerios'),
  ('Cadenas / Gastos Menores', 'egreso', 'Gastos operativos menores de la tienda y suministros'),
  ('Base de Caja Adicional', 'ingreso', 'Inyección de dinero en efectivo adicional para fondo de caja'),
  ('Transporte y Domicilios', 'egreso', 'Pagos de fletes, mensajería, taxis o domicilios'),
  ('Otros Gastos Operativos', 'egreso', 'Gastos varios autorizados por la administración')
ON CONFLICT DO NOTHING;
