const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, internal_code, status, observaciones')
    .eq('id', '51239b39-c80b-4385-a8cd-48d75e704767')
    .single();

  if (error) {
    console.error(error);
    return;
  }
  console.log('Observations for OC-6WIZZ:');
  console.log(data.observaciones);
}

main().catch(console.error);
