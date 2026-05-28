const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listFabrics() {
  const { data: fabrics, error } = await supabase.from('fabrics').select('*').limit(10);
  if (error) {
    console.error('Error fetching fabrics:', error);
  } else {
    console.log('Fabrics rows:');
    fabrics.forEach(f => {
      console.log(`ID: ${f.id} | Name: ${f.name} | Nombre Tela: ${f.nombre_tela} | Factura: ${f.factura_relacionada} | Capas: ${f.capas}`);
    });
  }
}

listFabrics();
