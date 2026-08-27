import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5ODcyOCwiZXhwIjoyMDk0MTc0NzI4fQ.ULyRBs2AN6YWs7QTzsDXk9QWyO-aLLriXX733UN9qiU';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || serviceRoleKey;

export const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey
);

