const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCutsSchema() {
  const { data: cuts, error: cutsErr } = await supabase.from('cuts').select('*').limit(1);
  if (cutsErr) {
    console.error('Error fetching cuts:', cutsErr);
  } else {
    console.log('Cuts columns:', cuts.length > 0 ? Object.keys(cuts[0]) : 'No cuts rows');
    console.log('Sample cut:', cuts[0]);
  }

  const { data: cat, error: catErr } = await supabase.from('categories').select('*').limit(1);
  if (catErr) {
    console.error('Error fetching categories:', catErr);
  } else {
    console.log('Categories columns:', cat.length > 0 ? Object.keys(cat[0]) : 'No categories rows');
    console.log('Sample category:', cat[0]);
  }
}

checkCutsSchema();
