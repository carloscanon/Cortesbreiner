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

async function simulate() {
  const term = '0082007980';
  const { data: garment } = await supabase
    .from('individual_garments')
    .select('*, sewing_orders(*, products(*))')
    .eq('barcode', term)
    .single();

  console.log('Garment reference_name:', garment.reference_name);

  // Load products list like POS does
  const { data: products } = await supabase.from('products').select('*, categories(*)');
  console.log('Total products loaded in POS:', products.length);

  // resolveProductForGarment implementation from pos/page.tsx:
  const resolveProductForGarment = (garment) => {
    if (!garment) return null;
    const refRaw = (garment.reference_name || '').trim().toLowerCase();
    const cleanRef = refRaw.replace(/\s*premium\s*/gi, '').trim();

    // 1. Direct ID match from sewing_orders
    if (garment.sewing_orders?.product_id) {
      const p = products.find(prod => prod.id === garment.sewing_orders.product_id);
      if (p) return p;
    }

    // 2. Exact match by reference code or full name
    let found = products.find(p => {
      const pName = (p.nombre_producto || '').trim().toLowerCase();
      const pCode = (p.codigo_referencia || '').trim().toLowerCase();
      return pName === refRaw || pCode === refRaw;
    });
    if (found) return found;

    // 3. Clean name match
    found = products.find(p => {
      const pName = (p.nombre_producto || '').trim().toLowerCase();
      const pClean = pName.replace(/\s*premium\s*/gi, '').trim();
      const pCat = (p.categories?.categoria || '').trim().toLowerCase();
      const pCode = (p.codigo_referencia || '').trim().toLowerCase();
      return pClean === cleanRef || pCat === cleanRef || pCode === cleanRef ||
        (cleanRef.length >= 4 && pClean.includes(cleanRef)) ||
        (cleanRef.length >= 4 && cleanRef.includes(pClean));
    });
    if (found) return found;

    // 4. Keyword / category match
    found = products.find(p => {
      const pName = (p.nombre_producto || '').trim().toLowerCase();
      const pCat = (p.categories?.categoria || '').trim().toLowerCase();
      const words = cleanRef.split(' ').filter(w => w.length > 3);
      return words.length > 0 && words.every(w => pName.includes(w) || pCat.includes(w));
    });

    return found || null;
  };

  const matchedProduct = resolveProductForGarment(garment);
  console.log('Result of resolveProductForGarment:', matchedProduct ? { id: matchedProduct.id, name: matchedProduct.nombre_producto, ref: matchedProduct.codigo_referencia } : 'NULL');

  // Fallback query from line 3090:
  if (!matchedProduct) {
    const cleanRef = (garment.reference_name || '').replace(/\s*premium\s*/gi, '').trim();
    console.log('cleanRef for fallback query:', cleanRef);
    const { data: dbProd, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .or(`nombre_producto.ilike.%${cleanRef}%,codigo_referencia.ilike.%${cleanRef}%,codigo_referencia.eq.21060`)
      .limit(1)
      .maybeSingle();
    console.log('Result of fallback DB query:', dbProd ? { id: dbProd.id, name: dbProd.nombre_producto, ref: dbProd.codigo_referencia } : 'NULL', 'error:', error);
  }
}
simulate();
