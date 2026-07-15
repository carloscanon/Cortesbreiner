const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const vars = {};
env.split('\n').forEach(l => {
  const eqIdx = l.indexOf('=');
  if (eqIdx < 0) return;
  const k = l.slice(0, eqIdx).trim();
  let v = l.slice(eqIdx + 1).trim();
  if (v.length > 1 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
  vars[k] = v;
});

const SUPABASE_URL = vars['NEXT_PUBLIC_SUPABASE_URL'] || 'https://kflasnvkwscpgxszuhrr.supabase.co';
const SERVICE_KEY = vars['SUPABASE_SERVICE_ROLE_KEY'];

const SQL_MIGRATION = `
-- 1. Create pos_roles table
CREATE TABLE IF NOT EXISTS pos_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for pos_roles
ALTER TABLE pos_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON pos_roles;
CREATE POLICY allow_all ON pos_roles FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Create pos_role_permissions table
CREATE TABLE IF NOT EXISTS pos_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES pos_roles(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  is_allowed BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(role_id, module_name)
);

-- Enable RLS for pos_role_permissions
ALTER TABLE pos_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON pos_role_permissions;
CREATE POLICY allow_all ON pos_role_permissions FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Add pos_role_id column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pos_role_id UUID REFERENCES pos_roles(id) ON DELETE SET NULL;
`;

async function main() {
  if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
    process.exit(1);
  }

  console.log('🔧 Initializing specific POS roles and permissions database schema via Supabase client...');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Call exec_sql with 'sql' parameter
  const { data, error } = await supabase.rpc('exec_sql', { sql: SQL_MIGRATION });

  if (error) {
    console.warn('  ⚠️ rpc("exec_sql", { sql }) failed. Trying { sql_query }...');
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql_query: SQL_MIGRATION });
    
    if (error2) {
      console.warn('  ⚠️ rpc("exec_sql", { sql_query }) failed. Trying { query }...');
      const { data: data3, error: error3 } = await supabase.rpc('exec_sql', { query: SQL_MIGRATION });
      
      if (error3) {
        console.error('❌ Error running POS roles migration:', error3.message);
        process.exit(1);
      }
      console.log('✓ POS roles schema verified and updated successfully:', data3);
      return;
    }
    console.log('✓ POS roles schema verified and updated successfully:', data2);
    return;
  }

  console.log('✓ POS roles schema verified and updated successfully:', data);
}

main().catch(console.error);
