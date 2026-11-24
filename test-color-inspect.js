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
    .select('id, fabric_id, color_id, cuts_composite_items(id, fabric_id, color_id, fabrics(nombre_tela), colors(nombre_color))')
    .not('cuts_composite_items', 'is', null)
    .limit(5);
  console.log('Cuts with composite:', cuts?.filter(c => c.cuts_composite_items?.length > 0));

  const { data: allFabrics } = await supabase.from('fabrics').select('id, nombre_tela').limit(30);
  console.log('Sample fabric names:');
  allFabrics?.forEach(f => console.log('Fabric:', f.nombre_tela));
}
check();
