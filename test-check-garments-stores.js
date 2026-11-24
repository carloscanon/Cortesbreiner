const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.trim().startsWith('#')) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function checkGarmentsInStores() {
  const BODEGA_LOCAL1_OLD = 'e8224540-34d8-483c-b3f1-daf4f46129be'; // Bodega Local 1
  const NUEVA_LOCAL1 = 'ef962be9-4a7c-481b-b5b4-65099cae0ed1'; // Nueva Local 1

  const BODEGA_LOCAL2_OLD = '05db1bd3-dc68-4f48-8efb-9e21520b954b'; // Bodega Local 2
  const NUEVA_LOCAL2 = 'd792762c-6dfd-4d57-aa9a-6e7e8cb46cdf'; // Nueva Local 2

  const { data: gL1Old } = await supabase.from('individual_garments').select('id, barcode, reference_name').eq('warehouse_id', BODEGA_LOCAL1_OLD);
  const { data: gL1New } = await supabase.from('individual_garments').select('id, barcode, reference_name').eq('warehouse_id', NUEVA_LOCAL1);

  console.log(`Garments in Bodega Local 1 (Old: ${BODEGA_LOCAL1_OLD}):`, gL1Old?.length);
  console.log(`Garments in Nueva Local 1 (New: ${NUEVA_LOCAL1}):`, gL1New?.length);

  const { data: gL2Old } = await supabase.from('individual_garments').select('id, barcode, reference_name').eq('warehouse_id', BODEGA_LOCAL2_OLD);
  const { data: gL2New } = await supabase.from('individual_garments').select('id, barcode, reference_name').eq('warehouse_id', NUEVA_LOCAL2);

  console.log(`Garments in Bodega Local 2 (Old: ${BODEGA_LOCAL2_OLD}):`, gL2Old?.length);
  console.log(`Garments in Nueva Local 2 (New: ${NUEVA_LOCAL2}):`, gL2New?.length);

  // Check finished_goods_stock in all 4 warehouses
  const { data: sL1Old } = await supabase.from('finished_goods_stock').select('cantidad_disponible').eq('warehouse_id', BODEGA_LOCAL1_OLD);
  const { data: sL1New } = await supabase.from('finished_goods_stock').select('cantidad_disponible').eq('warehouse_id', NUEVA_LOCAL1);
  const { data: sL2Old } = await supabase.from('finished_goods_stock').select('cantidad_disponible').eq('warehouse_id', BODEGA_LOCAL2_OLD);
  const { data: sL2New } = await supabase.from('finished_goods_stock').select('cantidad_disponible').eq('warehouse_id', NUEVA_LOCAL2);

  const sumL1Old = sL1Old?.reduce((a, b) => a + (Number(b.cantidad_disponible) || 0), 0);
  const sumL1New = sL1New?.reduce((a, b) => a + (Number(b.cantidad_disponible) || 0), 0);
  const sumL2Old = sL2Old?.reduce((a, b) => a + (Number(b.cantidad_disponible) || 0), 0);
  const sumL2New = sL2New?.reduce((a, b) => a + (Number(b.cantidad_disponible) || 0), 0);

  console.log(`Stock in Bodega Local 1: ${sumL1Old} (${sL1Old?.length} rows)`);
  console.log(`Stock in Nueva Local 1: ${sumL1New} (${sL1New?.length} rows)`);
  console.log(`Stock in Bodega Local 2: ${sumL2Old} (${sL2Old?.length} rows)`);
  console.log(`Stock in Nueva Local 2: ${sumL2New} (${sL2New?.length} rows)`);
}
checkGarmentsInStores();
