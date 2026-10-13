-- ==============================================================================
-- MIGRACIÓN / SCRIPT SQL: CATALOGACIÓN DE VENTAS POS POR ESTADO / CONCEPTO
-- Cortesbreiner ERP - Módulo POS
-- ==============================================================================

-- 1. Agregar columna concepto_venta a la tabla pos_sales si no existe
ALTER TABLE IF EXISTS public.pos_sales
ADD COLUMN IF NOT EXISTS concepto_venta TEXT DEFAULT 'Venta Detal / Minorista';

-- 2. Crear índice para optimizar búsquedas y filtros por concepto
CREATE INDEX IF NOT EXISTS idx_pos_sales_concepto ON public.pos_sales(concepto_venta);

-- 3. Si hay ventas con [CONCEPTO: ...] en observaciones, sincronizar la columna
UPDATE public.pos_sales
SET concepto_venta = TRIM(SUBSTRING(observaciones FROM '\[CONCEPTO:\s*([^\]]+)\]'))
WHERE observaciones ~ '\[CONCEPTO:\s*([^\]]+)\]'
  AND (concepto_venta IS NULL OR concepto_venta = 'Venta Detal / Minorista');

-- 4. Registrar los conceptos en company_params y settings como respaldo permanente
INSERT INTO public.company_params (name, value, description)
VALUES (
  'pos_sales_concepts',
  '[{"id":"detal","nombre":"Venta Detal / Minorista","color":"#10b981","descripcion":"Venta regular al detal en tienda física","is_default":true,"activo":true},{"id":"mayorista","nombre":"Ventas Mayoristas","color":"#3b82f6","descripcion":"Ventas al por mayor o distribuidores comerciales","is_default":false,"activo":true},{"id":"dotacion","nombre":"Dotación Empresarial","color":"#8b5cf6","descripcion":"Dotaciones para empresas y uniformes corporativos","is_default":false,"activo":true},{"id":"evento","nombre":"Venta Evento / Feria","color":"#f59e0b","descripcion":"Ventas en ferias comerciales o activaciones de marca","is_default":false,"activo":true},{"id":"cortesia","nombre":"Cortesía / Obsequio","color":"#ec4899","descripcion":"Salidas de cortesía, muestras o intercambios publicitarios","is_default":false,"activo":true},{"id":"consignacion","nombre":"Venta Consignación","color":"#06b6d4","descripcion":"Despachos o ventas bajo modalidad de consignación","is_default":false,"activo":true}]',
  'Conceptos de catalogación de ventas POS'
)
ON CONFLICT (name) DO UPDATE 
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

INSERT INTO public.settings (key, value, updated_at)
VALUES (
  'pos_sales_concepts',
  '[{"id":"detal","nombre":"Venta Detal / Minorista","color":"#10b981","descripcion":"Venta regular al detal en tienda física","is_default":true,"activo":true},{"id":"mayorista","nombre":"Ventas Mayoristas","color":"#3b82f6","descripcion":"Ventas al por mayor o distribuidores comerciales","is_default":false,"activo":true},{"id":"dotacion","nombre":"Dotación Empresarial","color":"#8b5cf6","descripcion":"Dotaciones para empresas y uniformes corporativos","is_default":false,"activo":true},{"id":"evento","nombre":"Venta Evento / Feria","color":"#f59e0b","descripcion":"Ventas en ferias comerciales o activaciones de marca","is_default":false,"activo":true},{"id":"cortesia","nombre":"Cortesía / Obsequio","color":"#ec4899","descripcion":"Salidas de cortesía, muestras o intercambios publicitarios","is_default":false,"activo":true},{"id":"consignacion","nombre":"Venta Consignación","color":"#06b6d4","descripcion":"Despachos o ventas bajo modalidad de consignación","is_default":false,"activo":true}]',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

-- 5. Comentario de verificación
COMMENT ON COLUMN public.pos_sales.concepto_venta IS 'Concepto o clasificación de la venta: Ej. Venta Detal / Minorista, Ventas Mayoristas, Dotación, etc.';
