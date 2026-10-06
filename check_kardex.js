const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase.from('finished_goods_kardex')
    .select('*, products(nombre_producto), warehouses!finished_goods_kardex_warehouse_dest_id_fkey(nombre_bodega)')
    .eq('tipo_movimiento', 'Ingreso por Inventario Histórico')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('KARDEX ERROR:', error);
  console.log('KARDEX:', JSON.stringify(data, null, 2));
})();
