// Script to create quality_inspections table and patch workshops columns
// Run with: node scripts/setup-quality-and-workshops.js

const SUPABASE_URL = 'https://plsvbuzcjtztpidsjmua.supabase.co';
// Needs service_role key - set via env: SUPABASE_SERVICE_KEY=xxx node scripts/setup-quality-and-workshops.js
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_KEY environment variable.');
  console.error('Run: set SUPABASE_SERVICE_KEY=your_service_role_key && node scripts/setup-quality-and-workshops.js\n');
  process.exit(1);
}

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  // Use pg endpoint
  const pgRes = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  return pgRes;
}

const SQL_WORKSHOPS_COLUMNS = `
-- Add optional columns to workshops if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workshops' AND column_name='responsable') THEN
    ALTER TABLE workshops ADD COLUMN responsable TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workshops' AND column_name='direccion') THEN
    ALTER TABLE workshops ADD COLUMN direccion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workshops' AND column_name='telefono') THEN
    ALTER TABLE workshops ADD COLUMN telefono TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workshops' AND column_name='especialidad') THEN
    ALTER TABLE workshops ADD COLUMN especialidad TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workshops' AND column_name='capacidad_diaria') THEN
    ALTER TABLE workshops ADD COLUMN capacidad_diaria INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workshops' AND column_name='activo') THEN
    ALTER TABLE workshops ADD COLUMN activo BOOLEAN DEFAULT TRUE;
  END IF;
END $$;
`;

const SQL_QUALITY_TABLE = `
-- Create quality_inspections table
CREATE TABLE IF NOT EXISTS quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  workshop_name TEXT,
  items_inspected INTEGER DEFAULT 0,
  items_approved INTEGER DEFAULT 0,
  items_rejected INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Aprobado', 'Reproceso', 'Rechazado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quality_inspections' AND policyname = 'allow_authenticated'
  ) THEN
    CREATE POLICY allow_authenticated ON quality_inspections
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant access
GRANT ALL ON quality_inspections TO authenticated;
GRANT SELECT ON quality_inspections TO anon;
`;

async function main() {
  console.log('🔧 Running DB setup via Supabase SQL API...\n');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  console.log('✓ Supabase reachable:', res.status);

  // Use the SQL execution endpoint
  const execute = async (label, sql) => {
    console.log(`\n▶ ${label}...`);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.warn(`  ⚠ RPC exec_sql not available (${r.status}). Copy SQL below to Supabase SQL editor.`);
      return false;
    }
    const data = await r.json();
    console.log('  ✓ Done:', JSON.stringify(data).slice(0, 120));
    return true;
  };

  const ok1 = await execute('Patching workshops columns', SQL_WORKSHOPS_COLUMNS);
  const ok2 = await execute('Creating quality_inspections table', SQL_QUALITY_TABLE);

  if (!ok1 || !ok2) {
    console.log('\n──────────────────────────────────────────────────');
    console.log('📋 RUN THIS SQL IN YOUR SUPABASE SQL EDITOR:');
    console.log('   https://supabase.com/dashboard/project/plsvbuzcjtztpidsjmua/sql');
    console.log('──────────────────────────────────────────────────\n');
    console.log(SQL_WORKSHOPS_COLUMNS);
    console.log(SQL_QUALITY_TABLE);
    console.log('──────────────────────────────────────────────────\n');
  }
}

main().catch(console.error);
