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

async function checkFGTransfers() {
  const targetBarcode = '0082007980';
  
  // 1. Check finished_goods_transfers
  const { data: transfers } = await supabase
    .from('finished_goods_transfers')
    .select('*, items:finished_goods_transfer_items(*)')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Finished goods transfers count:', transfers?.length);
  transfers?.forEach(t => {
    console.log(`Transfer #${t.consecutive || t.id} | Status: ${t.status} | Orig: ${t.warehouse_orig_id} | Dest: ${t.warehouse_dest_id} | Created: ${t.created_at}`);
    console.log(`  Items: ${t.items?.length}`);
    t.items?.forEach(it => {
      console.log(`    Prod: ${it.product_id} | Qty: ${it.quantity} | Barcodes: ${JSON.stringify(it.scanned_barcodes || it.barcodes)}`);
    });
  });

  // 2. Search all finished_goods_transfer_items for targetBarcode
  const { data: allItems } = await supabase
    .from('finished_goods_transfer_items')
    .select('*, transfer:finished_goods_transfers(*)');
  
  const matching = allItems?.filter(it => {
    const bcs = JSON.stringify(it);
    return bcs.includes(targetBarcode);
  });
  console.log('Matching transfer items for barcode 0082007980:', matching);
}
checkFGTransfers();
