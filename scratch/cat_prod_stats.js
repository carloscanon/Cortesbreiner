const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCategoriesAndProducts() {
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: products } = await supabase.from('products').select('*');

  console.log(`Total categories: ${categories.length}`);
  console.log(`Total products: ${products.length}`);

  // For each category, see how many products reference it
  const catStats = categories.map(cat => {
    const matchingProducts = products.filter(p => p.category_id === cat.id);
    return {
      catId: cat.id,
      catName: cat.categoria,
      productCount: matchingProducts.length,
      sampleProduct: matchingProducts[0]?.nombre_producto || 'NONE'
    };
  });

  console.log('Category to Product counts:');
  console.log(catStats.slice(0, 15));

  // Are there any categories with 0 products?
  const zeroProds = catStats.filter(s => s.productCount === 0);
  console.log(`Categories with 0 products: ${zeroProds.length}`);
  if (zeroProds.length > 0) {
    console.log('Zero products sample:', zeroProds.slice(0, 5));
  }
}

checkCategoriesAndProducts();
