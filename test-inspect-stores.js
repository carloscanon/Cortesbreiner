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

async function inspectStores() {
  const { data: stores } = await supabase.from('stores').select('*');
  console.log('Stores full table:', stores);

  const { data: transfers } = await supabase.from('inventory_transfers')
    .select('id, transfer_code, origin_warehouse_id, destination_warehouse_id, warehouse_orig_id, warehouse_dest_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Transfers:', transfers);
}
inspectStores();
