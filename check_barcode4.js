const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  const { data } = await supabase.from('individual_garments')
    .select('*, sewing_orders(product_id), quality_inspections(order_id)')
    .eq('barcode', '0081962911');
  console.log('GARMENT:', JSON.stringify(data, null, 2));
})();
