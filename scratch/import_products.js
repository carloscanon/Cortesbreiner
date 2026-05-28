const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importProducts() {
  const data = fs.readFileSync('c:/Users/carlo/Desktop/Cortesbreiner/Productos CSV.csv', 'utf8');
  const lines = data.split(/\r?\n/);
  
  const { data: categories, error: catError } = await supabase.from('categories').select('*');
  if (catError) {
    console.error('Error fetching categories:', catError);
    return;
  }
  
  const catMap = {};
  for (const cat of categories) {
    catMap[cat.categoria.toLowerCase().trim()] = cat.id;
  }
  
  const productsToInsert = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(';');
    if (parts.length < 7) continue;
    
    const ref = parts[0].trim();
    const name = parts[1].trim();
    const catName = parts[2].trim();
    const genero = parts[4].trim();
    const ivaStr = parts[6].trim();
    
    let iva = 19;
    if (ivaStr.includes('19')) iva = 19;
    
    let category_id = catMap[catName.toLowerCase()];
    if (!category_id) {
      console.log(`Categoría no encontrada para "${catName}".`);
      category_id = null;
    }
    
    // Only insert if it doesn't have an empty name
    if (!name || name.startsWith('NO USAR')) continue;
    
    productsToInsert.push({
      codigo_referencia: ref,
      nombre_producto: name,
      category_id: category_id,
      genero: genero === 'F' || genero === 'M' ? genero : null,
      iva: iva,
      precio: 0,
      precio_con_iva: 0
    });
  }
  
  console.log(`Found ${productsToInsert.length} valid products to insert.`);
  
  // To avoid duplication, we might just insert, but if there's a unique constraint on codigo_referencia, we could use upsert.
  // Using upsert based on codigo_referencia if possible, or just insert.
  
  let insertedCount = 0;
  for (let i = 0; i < productsToInsert.length; i += 100) {
    const batch = productsToInsert.slice(i, i + 100);
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${i}:`, error.message);
    } else {
      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount}/${productsToInsert.length} products...`);
    }
  }
  console.log('Import complete.');
}

importProducts();
