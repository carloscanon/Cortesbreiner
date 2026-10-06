const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  // Check individual_garments
  const { data: garments } = await supabase
    .from('individual_garments')
    .select('id, reference_name')
    .ilike('reference_name', '%premiun%');
  console.log(`Found ${garments.length} garments with 'premiun' in reference_name`);

  // Check products
  const { data: products } = await supabase
    .from('products')
    .select('id, nombre_producto')
    .ilike('nombre_producto', '%premiun%');
  console.log(`Found ${products.length} products with 'premiun' in nombre_producto`);

})();
