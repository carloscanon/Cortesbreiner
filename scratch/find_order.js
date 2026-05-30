const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://plsvbuzcjtztpidsjmua.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5ODcyOCwiZXhwIjoyMDk0MTc0NzI4fQ.ULyRBs2AN6YWs7QTzsDXk9QWyO-aLLriXX733UN9qiU'
);

async function main() {
  // Buscar órdenes sin código OC en estado Cortado
  const { data, error } = await supabase
    .from('orders')
    .select('id, internal_code, brand, status, created_at')
    .eq('status', 'Cortado')
    .is('internal_code', null);

  console.log('Órdenes sin código en estado Cortado:', JSON.stringify(data, null, 2));
}
main();
