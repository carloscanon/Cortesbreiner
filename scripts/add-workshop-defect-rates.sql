-- Ejecuta este SQL en el editor de Supabase:
-- https://supabase.com/dashboard/project/plsvbuzcjtztpidsjmua/sql

-- 1. Agregar columnas de descuento por tipo de defecto a la tabla workshops
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS desc_costuras  NUMERIC DEFAULT 500;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS desc_lavanderia NUMERIC DEFAULT 500;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS desc_saldos     NUMERIC DEFAULT 500;

-- 2. Asegurarse de que los talleres existentes tengan 500 si el valor es NULL
UPDATE workshops SET desc_costuras  = 500 WHERE desc_costuras  IS NULL;
UPDATE workshops SET desc_lavanderia = 500 WHERE desc_lavanderia IS NULL;
UPDATE workshops SET desc_saldos     = 500 WHERE desc_saldos     IS NULL;

-- 3. Recargar caché del esquema PostgREST
NOTIFY pgrst, 'reload schema';
