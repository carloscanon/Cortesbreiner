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

async function checkStoreInventory() {
  const targetStoreId = '792b5869-5171-4610-ac82-efa434df72fb'; // Local Gran San Local I
  const { data: storeInv } = await supabase
    .from('store_inventory')
    .select('*, product:products(nombre_producto, codigo_referencia)')
    .eq('store_id', targetStoreId)
    .limit(20);

  console.log('Store inventory count for Local 1:', storeInv?.length);
  storeInv?.forEach(si => {
    console.log(`Product: ${si.product?.nombre_producto} | Cant: ${si.cantidad_disponible}`);
  });

  // Check store_inventory for Emy
  const { data: emyInv } = await supabase
    .from('store_inventory')
    .select('*, product:products(nombre_producto, codigo_referencia)')
    .eq('store_id', targetStoreId)
    .ilike('product.nombre_producto', '%Emy%');
  console.log('Emy in store_inventory for Local 1:', emyInv);
}
checkStoreInventory();
