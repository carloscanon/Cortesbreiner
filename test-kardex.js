const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.trim().startsWith('#')) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function checkKardexAndHistory() {
  const targetBarcode = '0082007980';
  
  // 1. Check finished_goods_kardex
  const { data: kardex } = await supabase
    .from('finished_goods_kardex')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('Recent finished_goods_kardex:');
  kardex?.forEach(k => {
    console.log(`Kardex ID: ${k.id} | Tipo: ${k.tipo_movimiento} | Doc: ${k.documento_origen} | Wh Orig: ${k.warehouse_orig_id} | Wh Dest: ${k.warehouse_dest_id} | Cant: ${k.cantidad}`);
  });

  // 2. Check garment details
  const { data: g } = await supabase
    .from('individual_garments')
    .select('*')
    .eq('barcode', targetBarcode)
    .single();
  console.log('\nTarget Garment:', g);

  // 3. Check finished_goods_stock for this reference/product
  const { data: prods } = await supabase.from('products').select('*').ilike('nombre_producto', '%Emy%');
  console.log('\nProducts matching Emy:', prods?.map(p => ({ id: p.id, name: p.nombre_producto, ref: p.codigo_referencia })));

  if (prods && prods[0]) {
    const { data: stock } = await supabase
      .from('finished_goods_stock')
      .select('*, warehouse:warehouses(nombre_bodega)')
      .eq('product_id', prods[0].id);
    console.log('\nStock for Emy:', stock?.map(s => ({
      wh: s.warehouse?.nombre_bodega,
      wh_id: s.warehouse_id,
      color: s.color_id,
      size: s.size_id,
      disp: s.cantidad_disponible,
      res: s.cantidad_reservada
    })));
  }
}
checkKardexAndHistory();
