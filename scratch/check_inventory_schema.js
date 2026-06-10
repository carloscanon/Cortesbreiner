const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5ODcyOCwiZXhwIjoyMDk0MTc0NzI4fQ.ULyRBs2AN6YWs7QTzsDXk9QWyO-aLLriXX733UN9qiU';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase.from('fabric_inventory').select('*').limit(1);
  if (error) {
    console.error('Error fetching fabric_inventory:', error);
  } else {
    console.log('fabric_inventory sample:', data);
  }
}
run();
