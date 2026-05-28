const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkOrdersColumns() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error('Error fetching orders:', error);
  } else {
    console.log('Orders columns:', Object.keys(data[0]));
    console.log('Sample order:', data[0]);
  }
}

checkOrdersColumns();
