import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
  console.log('🚀 Creando usuario administrador...');
  
  const { data, error } = await supabase.auth.signUp({
    email: 'carloscanon@consultoresexpertos.com.co',
    password: 'Breiner2024*', // Contraseña temporal
  });

  if (error) {
    console.error('❌ Error al crear usuario:', error.message);
  } else {
    console.log('✅ Usuario creado con éxito:', data.user?.email);
    console.log('------------------------------------------');
    console.log('Credenciales de acceso:');
    console.log('Email: carloscanon@consultoresexpertos.com.co');
    console.log('Password: Breiner2024*');
    console.log('------------------------------------------');
    console.log('IMPORTANTE: Revisa tu correo para confirmar la cuenta si el email confirmation está activo en Supabase.');
  }
}

createAdmin();
