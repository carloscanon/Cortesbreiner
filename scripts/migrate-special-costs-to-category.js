const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?([^\n\r"]+)"?/)[1].trim();
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^\n\r"]+)"?/)[1].trim();

const SQL_MIGRATE = `
-- Eliminar restricciones y columna de producto
ALTER TABLE workshop_special_costs DROP CONSTRAINT IF EXISTS workshop_special_costs_workshop_id_product_id_key;
ALTER TABLE workshop_special_costs DROP COLUMN IF EXISTS product_id;

-- Agregar columna de categoría y la nueva restricción única
ALTER TABLE workshop_special_costs ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE CASCADE;
ALTER TABLE workshop_special_costs ADD CONSTRAINT workshop_special_costs_workshop_id_category_id_key UNIQUE (workshop_id, category_id);
`;

async function main() {
  console.log('🔧 Migrating workshop_special_costs table via pg/query endpoint...');

  const r = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ query: SQL_MIGRATE }),
  });

  if (!r.ok) {
    const text = await r.text();
    console.error(`❌ Error running pg/query: ${r.status} ${text}`);
    process.exit(1);
  }

  const data = await r.json();
  console.log('✓ Table workshop_special_costs migrated successfully to category_id!', data);
}

main().catch(console.error);
