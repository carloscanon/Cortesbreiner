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

async function check() {
  const { data: cuts } = await supabase.from('cuts')
    .select('id, order_id, product_id, fabric_id, color_id, fabrics(nombre_tela), products(nombre_producto), colors(nombre_color)')
    .or('product_id.eq.461960b8-5d1a-45e7-9485-af40e2dc50e8,product_id.eq.4576e8f3-8cb3-46f8-a007-e82864a2cc9a');

  console.log('Total cuts for Monaco & Roma:', cuts?.length);
  cuts?.forEach(c => {
    console.log(`Product: ${c.products?.nombre_producto} | Fabric: ${c.fabrics?.nombre_tela} | Color: ${c.colors?.nombre_color || 'NULL'}`);
  });
}
check();
