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

async function inspect() {
  const targetBarcode = '0082007980';
  console.log('Investigating barcode:', targetBarcode);

  // 1. Check individual_garments
  const { data: garment, error: gErr } = await supabase
    .from('individual_garments')
    .select('*, warehouse:warehouses(*)')
    .eq('barcode', targetBarcode)
    .maybeSingle();

  console.log('Garment record:', garment);

  // 2. Check warehouses
  const { data: warehouses } = await supabase.from('warehouses').select('*');
  console.log('Warehouses in DB:');
  warehouses?.forEach(w => console.log(`ID: ${w.id} | Name: ${w.nombre_bodega || w.name} | Code: ${w.code} | Type: ${w.tipo_bodega || w.type}`));

  // 3. Check inventory_transfers and transfer items containing this barcode
  const { data: transferItems } = await supabase
    .from('inventory_transfer_items')
    .select('*, transfer:inventory_transfers(*)')
    .eq('barcode', targetBarcode);
  console.log('Transfer items for this barcode:', transferItems);

  // 4. Check if there are other transfers where barcode is listed or if it was transferred
  const { data: allTransfers } = await supabase
    .from('inventory_transfers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Recent transfers:', allTransfers);
}
inspect();
