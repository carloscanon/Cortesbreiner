const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCategories() {
  console.log('Fetching categories...');
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }

  console.log(`Found ${categories.length} categories.`);
  
  let count = 1;
  for (const cat of categories) {
    const newCode = `CAT-${count.toString().padStart(3, '0')}`;
    if (cat.cod_categoria !== newCode) {
      console.log(`Updating category ${cat.id} (${cat.categoria}) to code ${newCode}...`);
      const { error: updateError } = await supabase
        .from('categories')
        .update({ cod_categoria: newCode })
        .eq('id', cat.id);
        
      if (updateError) {
        console.error(`Error updating category ${cat.id}:`, updateError);
      } else {
        console.log(`Successfully updated category ${cat.id}`);
      }
    } else {
      console.log(`Category ${cat.id} already has correct code ${newCode}.`);
    }
    count++;
  }
  console.log('Done fixing categories.');
}

fixCategories();
