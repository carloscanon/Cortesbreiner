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
  const STORE_2_ID = '1fdebcae-4b5b-4c7b-84d0-19fae1b477c1';

  // 1. All individual garments in Bodega 2
  const { data: gB2 } = await supabase
    .from('individual_garments')
    .select('id, barcode, reference_name, color_name, size_code, warehouse_id, sewing_order_id')
    .eq('warehouse_id', BODEGA_2_ID);

  console.log(`Garments in individual_garments for Bodega 2: ${gB2?.length}`);

  // Group garments by reference_name, color_name, size_code
  const gGroup = {};
  gB2?.forEach(g => {
    const key = `${g.reference_name} | ${g.color_name} | ${g.size_code}`;
    gGroup[key] = (gGroup[key] || 0) + 1;
  });
  console.log('Garments in Bodega 2 grouped by Ref/Color/Size:', gGroup);

  // 2. All finished_goods_stock in Bodega 2
  const { data: stockB2 } = await supabase
    .from('finished_goods_stock')
    .select('*, products(id, nombre_producto, codigo_referencia), colors(id, nombre_color), sizes(id, codigo_talla)')
    .eq('warehouse_id', BODEGA_2_ID);

  console.log(`Stock rows in finished_goods_stock for Bodega 2: ${stockB2?.length}`);
  const sGroup = {};
  stockB2?.forEach(s => {
    const key = `${s.products?.nombre_producto || s.products?.codigo_referencia} | ${s.colors?.nombre_color} | ${s.sizes?.codigo_talla}`;
    sGroup[key] = (sGroup[key] || 0) + s.cantidad_disponible;
  });
  console.log('Stock in Bodega 2 sample:', Object.keys(sGroup).slice(0, 15));

  // Check transfers to Bodega 2
  const { data: transfers } = await supabase
    .from('finished_goods_transfers')
    .select('*, finished_goods_transfer_items(*)')
    .eq('warehouse_dest_id', BODEGA_2_ID);
  console.log(`Transfers to Bodega 2: ${transfers?.length}`);

})();
