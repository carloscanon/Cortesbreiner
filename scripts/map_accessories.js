const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?([^\n\r"]+)"?/)[1].trim();
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^\n\r"]+)"?/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Pagination helper
const fetchAll = async (queryBuilder) => {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + step - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += step;
      if (data.length < step) break;
    } else {
      break;
    }
  }
  return allData;
};

async function main() {
  const csvPath = path.resolve('Listado de productos v1.0.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

  console.log('Loading all accessories and products...');
  const existingAccs = await fetchAll(supabase.from('accessories').select('id,nombre'));
  const existingProds = await fetchAll(supabase.from('products').select('id,codigo_referencia,nombre_producto'));

  console.log(`Loaded ${existingAccs.length} accessories and ${existingProds.length} products.`);

  const accIdMap = new Map();
  existingAccs.forEach(a => accIdMap.set(a.nombre.toLowerCase().trim(), a.id));
  
  const prodIdMap = new Map();
  existingProds.forEach(p => {
    if (p.codigo_referencia) prodIdMap.set(p.codigo_referencia.trim(), p.id);
    if (p.nombre_producto) prodIdMap.set(p.nombre_producto.toLowerCase().trim(), p.id);
  });

  const productAccRows = [];
  const seenPairs = new Set();
  let warningsCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 5) continue;
    
    const codRef = parts[0].trim();
    const prodName = parts[1].trim();
    const rawAccs = parts[4].trim();

    if (!rawAccs) continue;

    let productId = prodIdMap.get(codRef) || prodIdMap.get(prodName.toLowerCase());
    if (!productId) {
      warningsCount++;
      if (warningsCount <= 10) {
        console.log(`Warning: Product not found for ${codRef} - ${prodName}`);
      }
      continue;
    }

    const accNames = rawAccs.split(',').map(a => a.trim()).filter(a => a);
    for (const accName of accNames) {
      const accessoryId = accIdMap.get(accName.toLowerCase());
      if (!accessoryId) {
        console.log(`Warning: Accessory not found for ${accName}`);
        continue;
      }

      const pairKey = `${productId}-${accessoryId}`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        productAccRows.push({
          product_id: productId,
          accessory_id: accessoryId,
          cantidad: 1
        });
      }
    }
  }

  console.log(`Total warnings for missing products: ${warningsCount}`);
  console.log(`Generated ${productAccRows.length} accessory relationships to insert.`);

  // Delete all existing mappings first to perform a clean and complete sweep
  console.log('Cleaning up existing mappings from product_accessories...');
  const { error: deleteErr } = await supabase.from('product_accessories').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  if (deleteErr) {
    console.error('Error deleting existing mappings:', deleteErr.message);
  }

  // Insert product_accessories in batches of 500
  const BATCH = 500;
  let successCount = 0;
  for (let i = 0; i < productAccRows.length; i += BATCH) {
    const batch = productAccRows.slice(i, i + BATCH);
    const { error } = await supabase.from('product_accessories').insert(batch);
    if (error) {
      console.error('Batch insert error:', error.message);
    } else {
      successCount += batch.length;
    }
  }

  console.log(`Successfully mapped ${successCount} accessories to products.`);
}

main().catch(err => console.error('Fatal error', err));
