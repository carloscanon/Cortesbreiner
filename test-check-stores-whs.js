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

async function checkStoresAndWarehouses() {
  const { data: stores } = await supabase.from('stores').select('*');
  console.log('Stores:');
  stores?.forEach(s => {
    console.log(`Store ID: ${s.id} | Name: ${s.nombre} | Bodega asociada: ${s.bodega_asociada_id}`);
  });

  const { data: whs } = await supabase.from('warehouses').select('*');
  console.log('\nWarehouses:');
  whs?.forEach(w => {
    console.log(`Warehouse ID: ${w.id} | Nombre: ${w.nombre_bodega} | Tipo: ${w.tipo}`);
  });

  const { data: recentTransfers } = await supabase
    .from('finished_goods_transfers')
    .select('*, items:finished_goods_transfer_items(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nRecent 5 transfers:');
  recentTransfers?.forEach(t => {
    console.log(`Consecutive: ${t.consecutive} | ID: ${t.id} | Status: ${t.status} | Orig: ${t.warehouse_orig_id} | Dest: ${t.warehouse_dest_id}`);
    t.items?.forEach(it => {
      console.log(`   Prod: ${it.product_id} | Cant: ${it.quantity} | Barcodes count: ${it.scanned_barcodes?.length}`);
    });
  });
}
checkStoresAndWarehouses();
