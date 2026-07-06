const SUPABASE_URL = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}

const SQL_ORDER_SPECIAL_BILLING = `
-- Add pedido_especial column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='pedido_especial'
  ) THEN
    ALTER TABLE orders ADD COLUMN pedido_especial BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
`;

async function main() {
  console.log('🔧 Altering orders table via pg/query endpoint...');

  const r = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL_ORDER_SPECIAL_BILLING }),
  });

  if (!r.ok) {
    const text = await r.text();
    console.error(`❌ Error running pg/query: ${r.status} ${text}`);
    process.exit(1);
  }

  console.log('✓ Column pedido_especial added successfully to orders table!');
}

main().catch(console.error);
