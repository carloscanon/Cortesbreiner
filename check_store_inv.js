const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  const { data: storeInv, count } = await supabase
    .from('store_inventory')
    .select('*', { count: 'exact' });
  console.log('TOTAL ROWS IN store_inventory:', count, storeInv);

  // Check Local 2 (id: 1fdebcae-4b5b-4c7b-84d0-19fae1b477c1, bodega_asociada_id: 05db1bd3-dc68-4f48-8efb-9e21520b954b)
  const LOCAL_2_ID = '1fdebcae-4b5b-4c7b-84d0-19fae1b477c1';
  const BODEGA_2_ID = '05db1bd3-dc68-4f48-8efb-9e21520b954b';

  // Check finished_goods_stock for Bodega 2
  const { data: stockB2 } = await supabase
    .from('finished_goods_stock')
    .select('*, products(id, nombre_producto, codigo_referencia), colors(id, nombre_color), sizes(id, codigo_talla)')
    .eq('warehouse_id', BODEGA_2_ID)
    .gt('cantidad_disponible', 0);

  console.log(`Stock rows in finished_goods_stock for Bodega 2 (qty > 0): ${stockB2?.length}`);
  console.log('Sample stock row:', JSON.stringify(stockB2?.slice(0, 3), null, 2));

  // Check garment 0081963300's product in finished_goods_stock for Bodega 2
  const { data: g } = await supabase.from('individual_garments').select('*').eq('barcode', '0081963300').single();
  console.log('Garment 0081963300 details:', g);

  // Check sewing order for this garment
  if (g.sewing_order_id) {
    const { data: so } = await supabase.from('sewing_orders').select('*, products(*)').eq('id', g.sewing_order_id).single();
    console.log('Sewing Order & Product for 0081963300:', so);
    if (so?.product_id) {
      const { data: b2ProdStock } = await supabase
        .from('finished_goods_stock')
        .select('*')
        .eq('warehouse_id', BODEGA_2_ID)
        .eq('product_id', so.product_id);
      console.log(`Stock of product ${so.product_id} in Bodega 2:`, b2ProdStock);
    }
  }

})();
