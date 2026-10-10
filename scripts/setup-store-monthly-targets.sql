-- ==============================================================================
-- MIGRACIÓN / SCRIPT SQL: META MENSUAL POR SUCURSAL / TIENDA (POS)
-- Ejecuta este script en el SQL Editor del dashboard de Supabase
-- ==============================================================================

-- 1. Agregar la columna meta_mensual a la tabla stores (si no existe)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS meta_mensual NUMERIC DEFAULT 0;

-- 2. Asegurar permisos de acceso a la tabla stores
GRANT ALL ON public.stores TO authenticated;
GRANT ALL ON public.stores TO anon;
GRANT ALL ON public.stores TO service_role;

-- 3. Crear o asegurar tabla de persistencia adicional de settings
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON public.settings TO authenticated;
GRANT ALL ON public.settings TO anon;
GRANT ALL ON public.settings TO service_role;

-- 4. Notificar a PostgREST para recargar el esquema inmediatamente
NOTIFY pgrst, 'reload schema';
