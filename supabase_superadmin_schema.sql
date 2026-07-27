-- ==============================================================================
-- SCHEMA POSTGRES / SUPABASE PARA BRAINER ERP SAAS MULTITENANT SUPERADMIN SUITE
-- ==============================================================================

-- 1. TABLA PRINCIPAL DE EMPRESAS (TENANTS)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social VARCHAR(255) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(100) UNIQUE,
    logo_url TEXT,
    plan_code VARCHAR(50) DEFAULT 'STANDARD', -- 'TRIAL', 'STANDARD', 'PRO', 'ENTERPRISE'
    status VARCHAR(50) DEFAULT 'ACTIVA', -- 'ACTIVA', 'TRIAL', 'SUSPENDIDA', 'BLOQUEADA', 'VENCIDA'
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    renovacion_auto BOOLEAN DEFAULT TRUE,
    valor_mensual NUMERIC(12,2) DEFAULT 0.00,
    valor_anual NUMERIC(12,2) DEFAULT 0.00,
    usuarios_permitidos INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE MÓDULOS CONTRATADOS Y PERMISOS POR EMPRESA
CREATE TABLE IF NOT EXISTS public.tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    produccion BOOLEAN DEFAULT TRUE,
    confeccion BOOLEAN DEFAULT TRUE,
    calidad BOOLEAN DEFAULT TRUE,
    inventarios BOOLEAN DEFAULT TRUE,
    pos BOOLEAN DEFAULT FALSE,
    compras BOOLEAN DEFAULT TRUE,
    ventas BOOLEAN DEFAULT TRUE,
    talleres BOOLEAN DEFAULT TRUE,
    crm BOOLEAN DEFAULT FALSE,
    nomina BOOLEAN DEFAULT FALSE,
    ia BOOLEAN DEFAULT FALSE,
    reportes BOOLEAN DEFAULT TRUE,
    bi BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 3. AUDITORÍA CENTRALIZADA MULTITENANT (LOGS Y LOGINS)
CREATE TABLE IF NOT EXISTS public.global_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID,
    user_name VARCHAR(150),
    event_type VARCHAR(100) NOT NULL, -- 'LOGIN_SUCCESS', 'EXPORT_DATA', 'CHANGE_MODULE_PERM', 'SUSPEND_TENANT'
    module_name VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    browser VARCHAR(100),
    device_os VARCHAR(100),
    affected_record VARCHAR(255),
    previous_value JSONB,
    new_value JSONB,
    execution_time_ms INT,
    criticidad VARCHAR(20) DEFAULT 'Baja', -- 'Baja', 'Media', 'Alta', 'Crítica'
    resultado VARCHAR(20) DEFAULT 'Exitoso', -- 'Exitoso', 'Fallido'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CENTRO DE CONSUMO DE RECURSOS E INFRAESTRUCTURA POR TENANT
CREATE TABLE IF NOT EXISTS public.tenant_resource_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    storage_used_mb NUMERIC(10,2) DEFAULT 0.00,
    db_size_mb NUMERIC(10,2) DEFAULT 0.00,
    images_count INT DEFAULT 0,
    pdfs_count INT DEFAULT 0,
    stickers_count INT DEFAULT 0,
    invoices_count INT DEFAULT 0,
    orders_count INT DEFAULT 0,
    api_calls_count INT DEFAULT 0,
    ia_tokens_consumed INT DEFAULT 0,
    whatsapp_sent INT DEFAULT 0,
    emails_sent INT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 5. MESA DE AYUDA Y SOPORTE DE TICKETS
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_code VARCHAR(20) UNIQUE NOT NULL, -- e.g. 'TCK-1092'
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    requester_user_id UUID,
    requester_name VARCHAR(150),
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- 'Integración SIIGO', 'Hardware/Impresión', 'Facturación', 'Capacitación'
    priority VARCHAR(20) DEFAULT 'Media', -- 'Baja', 'Media', 'Alta', 'Crítica'
    status VARCHAR(20) DEFAULT 'Abierto', -- 'Abierto', 'En Proceso', 'Resuelto', 'Cerrado'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MENSAJES E HISTORIAL DE TICKETS DE SOPORTE
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID,
    sender_name VARCHAR(150) NOT NULL,
    is_superadmin BOOLEAN DEFAULT FALSE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REPORTE DE INFRAESTRUCTURA GLOBAL REALTIME
CREATE TABLE IF NOT EXISTS public.system_infrastructure_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpu_usage_pct NUMERIC(5,2),
    ram_usage_pct NUMERIC(5,2),
    disk_usage_pct NUMERIC(5,2),
    active_db_connections INT,
    redis_status VARCHAR(20),
    cache_hit_ratio NUMERIC(5,2),
    active_workers INT,
    api_latency_ms INT,
    active_websockets INT,
    backup_status VARCHAR(100),
    ssl_status VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- HABILITAR RLS Y POLÍTICAS DE ACCESO COMPLETO (SELECT, INSERT, UPDATE, DELETE)
-- Ejecutar en Supabase SQL Editor para resolver el error de RLS al crear empresas
-- ==============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_resource_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas
DROP POLICY IF EXISTS "Allow all for authenticated on tenants" ON public.tenants;
DROP POLICY IF EXISTS "Allow all for authenticated on tenant_modules" ON public.tenant_modules;
DROP POLICY IF EXISTS "Allow all for authenticated on global_audit_logs" ON public.global_audit_logs;
DROP POLICY IF EXISTS "Allow public insert on global_audit_logs" ON public.global_audit_logs;
DROP POLICY IF EXISTS "Allow all for authenticated on tenant_resource_usage" ON public.tenant_resource_usage;

-- Crear políticas universales para usuarios autenticados / SuperAdmin
CREATE POLICY "Allow all for authenticated on tenants"
ON public.tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated on tenant_modules"
ON public.tenant_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated on global_audit_logs"
ON public.global_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow public insert on global_audit_logs"
ON public.global_audit_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow all for authenticated on tenant_resource_usage"
ON public.tenant_resource_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);

