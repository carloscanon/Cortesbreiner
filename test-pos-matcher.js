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

function testMatcher(garment, products) {
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
  if (found) return found;

  // 5. Enhanced: Search in category name or prefix (e.g. "Emy" matches category "Body Emy")
  found = products.find(p => {
    const pCat = (p.categories?.categoria || '').trim().toLowerCase();
    const pName = (p.nombre_producto || '').trim().toLowerCase();
    const catWords = pCat.split(' ');
    // If category is "Body Emy", its second word is "emy" == cleanRef
    return catWords.includes(cleanRef) || pCat.includes(cleanRef) || pName.includes(cleanRef);
  });

  return found || null;
}

async function run() {
  const { data: products } = await supabase.from('products').select('*, categories(*)');
  const garment = { reference_name: 'Emy Premium' };
  const res = testMatcher(garment, products);
  console.log('Result for "Emy Premium":', res ? { id: res.id, name: res.nombre_producto, cat: res.categories?.categoria } : 'NULL');
}
run();
