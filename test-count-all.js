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

async function countAll(whId) {
  const { count, error } = await supabase
    .from('individual_garments')
    .select('*', { count: 'exact', head: true })
    .eq('warehouse_id', whId);
  return count;
}

async function run() {
  const whs = [
    { name: 'Bodega Local 1 (Old)', id: 'e8224540-34d8-483c-b3f1-daf4f46129be' },
    { name: 'Nueva Local 1 (New / Store Bodega)', id: 'ef962be9-4a7c-481b-b5b4-65099cae0ed1' },
    { name: 'Bodega Local 2 (Old)', id: '05db1bd3-dc68-4f48-8efb-9e21520b954b' },
    { name: 'Nueva Local 2 (New / Store Bodega)', id: 'd792762c-6dfd-4d57-aa9a-6e7e8cb46cdf' },
    { name: 'Bodega 101 Principal', id: '65797b78-39c1-4078-9475-80d7385823a6' },
    { name: 'Bodega Transito', id: 'a7de052c-cff0-46a4-989d-ed6eaab21a0e' }
  ];

  for (const w of whs) {
    const c = await countAll(w.id);
    console.log(`${w.name} (${w.id}): ${c} garments`);
  }

  // Check garment 0082007980
  const { data: g } = await supabase
    .from('individual_garments')
    .select('*, warehouse:warehouses(nombre_bodega)')
    .eq('barcode', '0082007980')
    .single();
  console.log('\nGarment 0082007980 details:');
  console.log(`Barcode: ${g.barcode} | Ref: ${g.reference_name} | Color: ${g.color_name} | Size: ${g.size_code} | Warehouse: ${g.warehouse?.nombre_bodega} (${g.warehouse_id}) | Status: ${g.status} | Notes: ${g.notes} | Store_id: ${g.store_id}`);
}
run();
