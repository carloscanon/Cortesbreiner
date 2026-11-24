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
  const { data: prods } = await supabase
    .from('products')
    .select('id, nombre_producto, codigo_referencia, category_id, categories(id, categoria)')
    .ilike('nombre_producto', '%Emy%');
  console.log('Products Emy:', prods);

  // Check how many individual garments have "Emy"
  const { data: emyGarms } = await supabase
    .from('individual_garments')
    .select('id, barcode, reference_name, color_name, size_code, warehouse_id, status')
    .ilike('reference_name', '%Emy%');
  console.log('Individual garments matching Emy:', emyGarms?.length);
  console.log('Sample Emy garments:', emyGarms?.slice(0, 5));
}
check();
