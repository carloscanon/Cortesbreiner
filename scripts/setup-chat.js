const fs = require('fs');
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
const SUPABASE_URL = vars['NEXT_PUBLIC_SUPABASE_URL'] || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const SERVICE_KEY = vars['SUPABASE_SERVICE_ROLE_KEY'];

if (!SERVICE_KEY) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const SQL_CHAT_TABLE = `
CREATE TABLE IF NOT EXISTS pos_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  store_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pos_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: allow everyone full access (anons and authenticated for simple real-time exchange)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pos_chat_messages' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY allow_all ON pos_chat_messages
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON pos_chat_messages TO authenticated;
GRANT ALL ON pos_chat_messages TO anon;
GRANT ALL ON pos_chat_messages TO service_role;
`;

async function main() {
  console.log('🔧 Creating pos_chat_messages table via exec_sql RPC...');

  let r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql: SQL_CHAT_TABLE }),
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
      body: JSON.stringify({ sql_query: SQL_CHAT_TABLE }),
    });
  }

  if (!r.ok) {
    const text = await r.text();
    console.error(`❌ Error running exec_sql RPC: ${r.status} ${text}`);
    process.exit(1);
  }

  const data = await r.json();
  console.log('✓ Chat table created/verified successfully:', data);
}


main().catch(console.error);
