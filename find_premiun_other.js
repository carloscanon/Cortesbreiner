const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  // Check sewing_orders
  const { data: sewing_orders } = await supabase
    .from('sewing_orders')
    .select('id, confeccion_code')
    .ilike('confeccion_code', '%premiun%');
  console.log(`Found ${sewing_orders?.length || 0} sewing_orders with 'premiun' in confeccion_code`);

  // Check orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, description')
    .ilike('description', '%premiun%');
  console.log(`Found ${orders?.length || 0} orders with 'premiun' in description`);
})();
