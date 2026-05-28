const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRelations() {
  const { data: prod } = await supabase.from('products').select('*').eq('id', '0aec7543-98af-4f9f-a026-c68655ec2513');
  console.log('Product exists:', prod);

  // Let's test inserting a cut with product_id set to a category ID to see if it throws foreign key error
  const { data: cat } = await supabase.from('categories').select('id').limit(1);
  if (cat.length > 0) {
    const catId = cat[0].id;
    console.log('Testing insert with category ID:', catId);
    
    // We do a transaction rollback if possible, but since we can't do transaction rollback easily, we'll try to insert a dummy cut, then delete it.
    const { data: newCut, error } = await supabase.from('cuts').insert([{
      order_id: 'bebcf3b7-af6c-41d9-ab87-982f2658e776', // existing order id from sample
      product_id: catId,
      color_id: null,
      layers: 0,
      consumption: 0,
      stroke_length: 1
    }]).select();

    if (error) {
      console.log('Insert failed (likely due to FK constraint):', error.message);
    } else {
      console.log('Insert succeeded! This means no FK constraint on product_id to products table, or it can accept category ID.');
      // Delete the dummy cut
      await supabase.from('cuts').delete().eq('id', newCut[0].id);
    }
  }
}

testRelations();
