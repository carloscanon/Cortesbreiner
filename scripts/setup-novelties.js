const SUPABASE_URL = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const SQL_NOVELTIES_TABLE = `
-- Create novelties table
CREATE TABLE IF NOT EXISTS novelties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_novedad TEXT NOT NULL,
  nombre TEXT NOT NULL,
  modulo_relac TEXT,
  criticidad TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE novelties ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'novelties' AND policyname = 'allow_authenticated'
  ) THEN
    CREATE POLICY allow_authenticated ON novelties
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant access
GRANT ALL ON novelties TO authenticated;
GRANT SELECT ON novelties TO anon;
`;

async function main() {
  console.log('🔧 Creating novelties table via pg/query...');

  const r = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL_NOVELTIES_TABLE }),
  });

  if (!r.ok) {
    const text = await r.text();
    console.error(`❌ Error running pg/query: ${r.status} ${text}`);
    process.exit(1);
  }

  const data = await r.json();
  console.log('✓ Table created successfully:', data);
}

main().catch(console.error);
