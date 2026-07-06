const SUPABASE_URL = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const SQL_SPECIAL_COSTS = `
-- Create workshop_special_costs table
CREATE TABLE IF NOT EXISTS workshop_special_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  special_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workshop_id, product_id)
);

-- Enable RLS
ALTER TABLE workshop_special_costs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workshop_special_costs' AND policyname = 'allow_authenticated'
  ) THEN
    CREATE POLICY allow_authenticated ON workshop_special_costs
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON workshop_special_costs TO authenticated;
GRANT SELECT ON workshop_special_costs TO anon;
`;

async function main() {
  console.log('🔧 Creating workshop_special_costs table via pg/query endpoint...');

  const r = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL_SPECIAL_COSTS }),
  });

  if (!r.ok) {
    const text = await r.text();
    console.error(`❌ Error running pg/query: ${r.status} ${text}`);
    process.exit(1);
  }

  const data = await r.json();
  console.log('✓ Table workshop_special_costs created successfully:', data);
}

main().catch(console.error);
