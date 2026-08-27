-- =========================================================================
-- SCRIPT SQL: AGREGAR COLUMNA DE ESTADO 'estado' EN TABLA PRODUCTS
-- Ejecuta este script en el Editor SQL de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/plsvbuzcjtztpidsjmua/sql
-- =========================================================================

-- 1. Agregar columna de estado si no existe
ALTER TABLE products ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

-- 2. Asegurar que todos los productos existentes queden en estado 'activo' por defecto
UPDATE products SET estado = 'activo' WHERE estado IS NULL OR estado = '';

-- 3. Notificar a PostgREST para recargar el esquema de API al instante
NOTIFY pgrst, 'reload schema';
