const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  console.log('--- 1. STORES ---');
  const { data: stores } = await supabase.from('stores').select('*');
  console.log(JSON.stringify(stores, null, 2));

  console.log('\n--- 2. WAREHOUSES ---');
  const { data: warehouses } = await supabase.from('warehouses').select('*');
  console.log(JSON.stringify(warehouses, null, 2));

  console.log('\n--- 3. GARMENT 0081963300 ---');
  const { data: garment } = await supabase
    .from('individual_garments')
    .select('*, warehouses(id, nombre_bodega), stores(id, nombre, nombre_sucursal)')
    .eq('barcode', '0081963300');
  console.log(JSON.stringify(garment, null, 2));

  if (garment && garment.length > 0) {
    const g = garment[0];
    console.log('\n--- 4. PRODUCT / STOCK FOR THIS GARMENT ---');
    // Find product matching reference_name
    const { data: prods } = await supabase
      .from('products')
      .select('id, nombre_producto, codigo_referencia')
      .or(`nombre_producto.ilike.%${g.reference_name}%,codigo_referencia.ilike.%${g.reference_name}%`);
    console.log('Matching Products:', prods);

    if (prods && prods.length > 0) {
      const pId = prods[0].id;
      const { data: stock } = await supabase
        .from('finished_goods_stock')
        .select('*, warehouses(id, nombre_bodega)')
        .eq('product_id', pId);
      console.log('Stock rows for this product across warehouses:', JSON.stringify(stock, null, 2));
    }
  }
})();
