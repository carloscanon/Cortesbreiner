const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  const BODEGA_2_ID = '05db1bd3-dc68-4f48-8efb-9e21520b954b';
  
  // Check Top Mangas Largo in products
  const { data: prods } = await supabase
    .from('products')
    .select('id, nombre_producto, codigo_referencia')
    .ilike('nombre_producto', '%mangas%');

  console.log('Products matching mangas:', prods);

  // Check finished_goods_stock for all these products
  for (const p of prods || []) {
    const { data: stock } = await supabase
      .from('finished_goods_stock')
      .select('*, warehouses(id, nombre_bodega), colors(nombre_color), sizes(codigo_talla)')
      .eq('product_id', p.id);
    
    console.log(`\nStock for ${p.nombre_producto} (${p.id}):`, JSON.stringify(stock, null, 2));
  }

  // Check how many items in finished_goods_stock belong to Bodega 2
  const { data: b2Stock } = await supabase
    .from('finished_goods_stock')
    .select('*, products(id, nombre_producto, codigo_referencia), colors(id, nombre_color), sizes(id, codigo_talla)')
    .eq('warehouse_id', BODEGA_2_ID);

  console.log(`\nTotal finished_goods_stock rows in Bodega 2: ${b2Stock?.length}`);
  const totalB2StockQty = b2Stock?.reduce((s, x) => s + (x.cantidad_disponible || 0), 0);
  console.log(`Total available qty in Bodega 2: ${totalB2StockQty}`);

})();
