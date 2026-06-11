const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('orders').select('id, internal_code, status, observaciones');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Orders in DB:');
  data.forEach(o => {
    console.log(`ID: ${o.id}, Code: ${o.internal_code}, Status: ${o.status}`);
  });
}

main().catch(console.error);
