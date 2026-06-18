const SUPABASE_URL = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const SQL_SEWING_DB = `
-- Create sewing_assignments table
CREATE TABLE IF NOT EXISTS sewing_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  category_id TEXT,
  size_code TEXT,
  workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sewing_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sewing_assignments' AND policyname = 'allow_authenticated'
  ) THEN
    CREATE POLICY allow_authenticated ON sewing_assignments
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON sewing_assignments TO authenticated;
GRANT SELECT ON sewing_assignments TO anon;

-- Create sewing_accessories table
CREATE TABLE IF NOT EXISTS sewing_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  cut_id UUID REFERENCES cuts(id) ON DELETE CASCADE,
  accessory_id UUID REFERENCES accessories(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sewing_accessories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sewing_accessories' AND policyname = 'allow_authenticated'
  ) THEN
    CREATE POLICY allow_authenticated ON sewing_accessories
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON sewing_accessories TO authenticated;
GRANT SELECT ON sewing_accessories TO anon;
`;

async function main() {
  console.log('🔧 Creating sewing_assignments and sewing_accessories tables via exec_sql RPC...');

  // Try calling exec_sql (which is a standard user-defined RPC in some supabase projects)
  // We will try passing 'sql' parameter first.
  let r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql: SQL_SEWING_DB }),
  });

  if (!r.ok) {
    console.log('  ⚠️ exec_sql with {sql} failed. Trying {sql_query}...');
    r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ sql_query: SQL_SEWING_DB }),
    });
  }

  if (!r.ok) {
    const text = await r.text();
    console.error(`❌ Error running exec_sql RPC: ${r.status} ${text}`);
    process.exit(1);
  }

  const data = await r.json();
  console.log('✓ Tables created successfully:', data);
}

main().catch(console.error);
