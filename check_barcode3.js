const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  const { data: stock } = await supabase.from('finished_goods_stock')
    .select('*, products(nombre_producto, codigo_referencia)')
    .eq('warehouse_id', '65797b78-39c1-4078-9475-80d7385823a6');
      
  const matches = stock.filter(s => s.products && JSON.stringify(s.products).toLowerCase().includes('paula'));
  console.log('ALL PAULA STOCK:', matches);
})();
