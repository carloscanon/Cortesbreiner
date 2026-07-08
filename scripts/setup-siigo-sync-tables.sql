-- SQL para crear tablas locales de sincronización de SIIGO
-- Ejecutar en el SQL Editor de Supabase: https://supabase.com/dashboard/project/plsvbuzcjtztpidsjmua/sql

-- 1. Tabla de Clientes locales sincronizados de SIIGO (para CRM rápido)
CREATE TABLE IF NOT EXISTS siigo_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siigo_id VARCHAR(100) UNIQUE,
    identification VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    person_type VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(100),
    city_name VARCHAR(150),
    city_code VARCHAR(10),
    state_name VARCHAR(150),
    vendedor_name VARCHAR(150),
    cupo_credito NUMERIC DEFAULT 0,
    saldo_mora NUMERIC DEFAULT 0,
    riesgo VARCHAR(20) DEFAULT 'Bajo', -- 'Bajo', 'Medio', 'Alto'
    rotacion VARCHAR(50) DEFAULT 'Media',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Facturas locales sincronizadas de SIIGO (para Trazabilidad)
CREATE TABLE IF NOT EXISTS siigo_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siigo_id VARCHAR(100) NOT NULL UNIQUE,
    consecutive VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    customer_identification VARCHAR(50) NOT NULL REFERENCES siigo_customers(identification) ON DELETE CASCADE,
    total NUMERIC NOT NULL DEFAULT 0,
    observations TEXT,
    status_dian VARCHAR(150) DEFAULT 'Aceptado por la DIAN',
    cufe VARCHAR(255),
    items JSONB DEFAULT '[]'::jsonb,
    payments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS
ALTER TABLE siigo_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE siigo_invoices ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir todo a usuarios autenticados siigo_customers" ON siigo_customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a usuarios autenticados siigo_invoices" ON siigo_invoices FOR ALL TO authenticated USING (true);

-- Notificar recarga del esquema
NOTIFY pgrst, 'reload schema';
