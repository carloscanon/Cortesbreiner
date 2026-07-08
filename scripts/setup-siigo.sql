-- Script de Base de Datos para Integración de ERP (SIIGO)
-- Ejecutar en el SQL Editor de Supabase: https://supabase.com/dashboard/project/plsvbuzcjtztpidsjmua/sql

-- 1. Tabla de configuraciones del ERP
CREATE TABLE IF NOT EXISTS erp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_name VARCHAR(50) NOT NULL UNIQUE, -- 'SIIGO', 'SAP', 'ODOO', etc.
    api_url VARCHAR(255) NOT NULL,
    environment VARCHAR(50) DEFAULT 'sandbox', -- 'sandbox', 'production'
    username VARCHAR(100) NOT NULL,
    access_key_encrypted TEXT NOT NULL, -- Access key / password encriptado
    partner_id VARCHAR(100),
    timeout_ms INTEGER DEFAULT 10000,
    max_retries INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 1000,
    headers JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla para almacenar el Token de forma segura
CREATE TABLE IF NOT EXISTS erp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_name VARCHAR(50) REFERENCES erp_config(erp_name) ON DELETE CASCADE UNIQUE,
    access_token_encrypted TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de logs de integración
CREATE TABLE IF NOT EXISTS erp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_name VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_payload JSONB,
    response_payload JSONB,
    headers JSONB,
    exception TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de auditoría
CREATE TABLE IF NOT EXISTS erp_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(150),
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS e insertar políticas básicas si aplica. 
-- Para este proyecto, permitiremos acceso total en estas tablas para simplificar, pero limitándolo al rol autenticado si fuera producción.
ALTER TABLE erp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a usuarios autenticados erp_config" ON erp_config FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a usuarios autenticados erp_tokens" ON erp_tokens FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a usuarios autenticados erp_logs" ON erp_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a usuarios autenticados erp_audit" ON erp_audit FOR ALL TO authenticated USING (true);

-- Notificar recarga del esquema
NOTIFY pgrst, 'reload schema';
