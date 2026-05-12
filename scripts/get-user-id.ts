import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getUserId() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'carloscanon@consultoresexpertos.com.co',
    password: 'Breiner2024*'
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('ID_DE_USUARIO:', data.user?.id);
  }
}

getUserId();
