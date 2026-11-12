-- =========================================================================
-- SCRIPT SQL: SOLUCIÓN ERROR RLS EN workshop_payments
-- =========================================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.workshop_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50),
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
    workshop_name TEXT,
    inspection_ids JSONB DEFAULT '[]'::jsonb,
    total_prendas NUMERIC DEFAULT 0,
    total_bruto NUMERIC DEFAULT 0,
    total_descuentos NUMERIC DEFAULT 0,
    total_neto NUMERIC DEFAULT 0,
    metodo_pago TEXT DEFAULT 'Transferencia Bancaria',
    numero_referencia TEXT,
    observaciones TEXT,
    status TEXT DEFAULT 'Pagado',
    created_by TEXT,
    paid_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Asegurar que Row Level Security (RLS) esté habilitado
ALTER TABLE public.workshop_payments ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas permisivas para usuarios autenticados y anónimos (alineado con las políticas del ERP)
DO $$
BEGIN
  -- Política para usuarios autenticados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'workshop_payments' 
      AND policyname = 'allow_all_workshop_payments_auth'
  ) THEN
    CREATE POLICY allow_all_workshop_payments_auth 
    ON public.workshop_payments 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
  END IF;

  -- Política para anon (en caso de que el cliente supabase use la anon key)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'workshop_payments' 
      AND policyname = 'allow_all_workshop_payments_anon'
  ) THEN
    CREATE POLICY allow_all_workshop_payments_anon 
    ON public.workshop_payments 
    FOR ALL 
    TO anon 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;

-- 4. Asignar permisos explícitos sobre la tabla a los roles correspondientes
GRANT ALL ON TABLE public.workshop_payments TO authenticated;
GRANT ALL ON TABLE public.workshop_payments TO anon;
GRANT ALL ON TABLE public.workshop_payments TO service_role;

-- 5. Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';
