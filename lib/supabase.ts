import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5ODcyOCwiZXhwIjoyMDk0MTc0NzI4fQ.ULyRBs2AN6YWs7QTzsDXk9QWyO-aLLriXX733UN9qiU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey || serviceRoleKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || supabaseAnonKey
);
