const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://plsvbuzcjtztpidsjmua.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5ODcyOCwiZXhwIjoyMDk0MTc0NzI4fQ.ULyRBs2AN6YWs7QTzsDXk9QWyO-aLLriXX733UN9qiU'
);

async function main() {
  const { data } = await supabase.from('orders').select('internal_code, cortador_name, brand, status').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
main();
