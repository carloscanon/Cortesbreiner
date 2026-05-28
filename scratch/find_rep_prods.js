const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findRepresentativeProducts() {
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: products } = await supabase.from('products').select('*');

  console.log('Categories count:', categories.length);
  
  categories.forEach(cat => {
    // See if there's any product whose name matches the category name exactly or closely
    const exactMatch = products.find(p => p.nombre_producto.toLowerCase() === cat.categoria.toLowerCase());
    const startsWithMatch = products.find(p => p.nombre_producto.toLowerCase().startsWith(cat.categoria.toLowerCase()));
    
    console.log(`Cat: "${cat.categoria}" | Exact product match: ${exactMatch ? exactMatch.nombre_producto : 'NONE'} | StartsWith match: ${startsWithMatch ? startsWithMatch.nombre_producto : 'NONE'}`);
  });
}

findRepresentativeProducts();
