const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  // Search individual_garments for barcode 0081963300 or similar
  const { data: gData, error: gErr } = await supabase
    .from('individual_garments')
    .select('*')
    .eq('barcode', '0081963300');

  console.log('Direct eq barcode 0081963300:', { gData, gErr });

  if (!gData || gData.length === 0) {
    const { data: searchLike } = await supabase
      .from('individual_garments')
      .select('*')
      .ilike('barcode', '%81963300%');
    console.log('Search like 81963300:', searchLike);
  }

  // Also search for any garments in Bodega 2
  const BODEGA_2_ID = '05db1bd3-dc68-4f48-8efb-9e21520b954b';
  const { count: countB2 } = await supabase
    .from('individual_garments')
    .select('*', { count: 'exact', head: true })
    .eq('warehouse_id', BODEGA_2_ID);
  console.log('Total individual garments in Bodega Local 2:', countB2);

  // Check finished_goods_stock in Bodega Local 2
  const { data: stockB2 } = await supabase
    .from('finished_goods_stock')
    .select('*, products(id, nombre_producto, codigo_referencia), colors(nombre_color), sizes(codigo_talla)')
    .eq('warehouse_id', BODEGA_2_ID);
  console.log('Stock rows in Bodega Local 2:', stockB2?.length);
  const totalStockB2 = stockB2?.reduce((s, x) => s + (x.cantidad_disponible || 0), 0);
  console.log('Total available stock in Bodega Local 2:', totalStockB2);

})();
