const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) from .env.local
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local file');
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?([^\n\r"]+)"?/);
const supabaseKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^\n\r"]+)"?/);
if (!supabaseUrlMatch || !supabaseKeyMatch) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}
const supabaseUrl = supabaseUrlMatch[1].trim();
const supabaseKey = supabaseKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

// Utility to generate sequential codes with leading zeros
function formatCode(prefix, num) {
  return `${prefix}${String(num).padStart(3, '0')}`;
}

async function main() {
  const csvPath = path.resolve('Listado de productos v1.0.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at', csvPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = lines[0].split(';').map(h => h.trim());
  console.log('CSV headers', headers);

  // Load existing reference data
  const [{ data: existingCats }, { data: existingAccs }, { data: existingProds }] = await Promise.all([
    supabase.from('categories').select('id,categoria,cod_categoria'),
    supabase.from('accessories').select('id,nombre,codigo'),
    supabase.from('products').select('id,codigo_referencia,nombre_producto,category_id')
  ]);

  const catMap = new Map(); // name -> {id,cod_categoria}
  existingCats.forEach(c => catMap.set(c.categoria.toLowerCase().trim(), c));
  const accMap = new Map(); // name -> {id,codigo}
  existingAccs.forEach(a => accMap.set(a.nombre.toLowerCase().trim(), a));
  const prodMap = new Map(); // codigo_referencia -> product object
  existingProds.forEach(p => prodMap.set(p.codigo_referencia.trim(), p));

  // Stage collections for batch inserts
  const newCategories = [];
  const newAccessories = [];
  const newProducts = [];
  const productAccRows = [];

  // Determine next sequential numbers
  const catCount = existingCats.length;
  let nextCatIdx = catCount + 1;
  const accCount = existingAccs.length;
  let nextAccIdx = accCount + 1;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 6) continue; // guard
    const [codRef, prodName, genero, catName, rawAccs, estado] = parts.map(p => p.trim());
    // ---------- Category ----------
    let cat = catMap.get(catName.toLowerCase());
    if (!cat) {
      const code = formatCode('CAT-', nextCatIdx++);
      cat = { categoria: catName, cod_categoria: code };
      newCategories.push(cat);
      catMap.set(catName.toLowerCase(), cat);
    }
    // ---------- Accessories ----------
    const accNames = rawAccs ? rawAccs.split(',').map(a => a.trim()).filter(a => a) : [];
    const accIds = [];
    for (const accName of accNames) {
      let acc = accMap.get(accName.toLowerCase());
      if (!acc) {
        const code = formatCode('ACC-', nextAccIdx++);
        acc = { nombre: accName, codigo: code, tipo: 'Otro', unidad_medida: 'unidades', costo_unitario: 0 };
        newAccessories.push(acc);
        accMap.set(accName.toLowerCase(), acc);
      }
      accIds.push(acc);
    }
    // ---------- Product ----------
    let product = prodMap.get(codRef);
    if (!product) {
      product = {
        codigo_referencia: codRef,
        nombre_producto: prodName,
        genero: genero,
        estado: estado || 'activo',
        category_id: null, // will fill after categories inserted
        iva: 0,
        precio: 0,
        precio_con_iva: 0
      };
      newProducts.push(product);
      // store temporary reference to map later using codRef key
      prodMap.set(codRef, product);
    }
    // Link later after category ids are known
    product._categoryName = catName; // temporary helper
    // Store accessory links for later
    if (!product._accessories) product._accessories = [];
    product._accessories.push(...accIds);
  }

  // ---- Upsert categories (avoid duplicates) ----
  if (newCategories.length) {
    const { error } = await supabase.from('categories').upsert(newCategories, { onConflict: 'cod_categoria' });
    if (error) console.error('Category upsert error', error.message);
  }
  // Refresh categories to get IDs
  const { data: updatedCats } = await supabase.from('categories').select('id,categoria');
  const catIdMap = new Map();
  updatedCats.forEach(c => catIdMap.set(c.categoria.toLowerCase(), c.id));
  // ---- Upsert accessories (avoid duplicates) ----
  if (newAccessories.length) {
    const { error } = await supabase.from('accessories').upsert(newAccessories, { onConflict: 'codigo' });
    if (error) console.error('Accessory upsert error', error.message);
  }
  const { data: updatedAccs } = await supabase.from('accessories').select('id,nombre');
  const accIdMap = new Map();
  updatedAccs.forEach(a => accIdMap.set(a.nombre.toLowerCase(), a.id));
  // ---- Prepare products for batch upsert ----
  // Resolve category_id for each product
  newProducts.forEach(p => {
    const catId = catIdMap.get(p._categoryName.toLowerCase());
    p.category_id = catId;
    delete p._categoryName;
  });
  // Clean temporary fields from products before upsert
  newProducts.forEach(p => {
    delete p._categoryName;
    delete p._accessories;
  });
  // Upsert products (conflict on codigo_referencia)
  if (newProducts.length) {
    const { error } = await supabase.from('products').upsert(newProducts, { onConflict: 'codigo_referencia' });
    if (error) console.error('Product upsert error', error.message);
  }
  // Refresh products to get IDs
  const { data: refreshedProds } = await supabase.from('products').select('id,codigo_referencia');
  const prodIdMap = new Map();
  refreshedProds.forEach(p => prodIdMap.set(p.codigo_referencia, p.id));
  // ---- Build product_accessories rows ----
  // Iterate over all products (including previously existing) stored in prodMap
  const seenPairs = new Set();
  for (const [codRef, prod] of prodMap.entries()) {
    const productId = prodIdMap.get(codRef);
    if (!productId) continue;
    const accessories = prod._accessories || [];
    for (const accObj of accessories) {
      const accessoryId = accIdMap.get(accObj.nombre.toLowerCase());
      if (!accessoryId) continue;
      const pairKey = `${productId}-${accessoryId}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      productAccRows.push({ product_id: productId, accessory_id: accessoryId, cantidad: 1 });
    }
    delete prod._accessories;
    delete prod._categoryName;
  }

  // Insert product_accessories in batches of 500 (use upsert to avoid duplicates)
  const BATCH = 500;
  for (let i = 0; i < productAccRows.length; i += BATCH) {
    const batch = productAccRows.slice(i, i + BATCH);
    const { error } = await supabase.from('product_accessories').upsert(batch, { onConflict: 'product_id,accessory_id' });
    if (error) console.error('product_accessories upsert error', error.message);
  }

  console.log('✅ Consolidation complete.');
}

main().catch(err => console.error('Fatal error', err));
