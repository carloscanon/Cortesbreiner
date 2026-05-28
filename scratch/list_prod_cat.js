const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listProductsAndCategories() {
  const { data: products } = await supabase.from('products').select('id, nombre_producto, category_id, categoria');
  console.log('PRODUCTS in DB:');
  console.log(products);

  const { data: categories } = await supabase.from('categories').select('id, categoria, cod_categoria');
  console.log('\nCATEGORIES in DB:');
  console.log(categories);
}

listProductsAndCategories();
