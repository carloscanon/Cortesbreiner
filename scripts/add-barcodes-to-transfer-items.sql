-- Script de migración para agregar la columna 'barcodes' (array de texto) a la tabla 'finished_goods_transfer_items'
-- Ejecutar este script en el Editor de SQL de Supabase (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE finished_goods_transfer_items 
ADD COLUMN IF NOT EXISTS barcodes text[] DEFAULT '{}';
