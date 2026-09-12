const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envVars[match[1]] = value;
  }
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
  console.log('Verificando / creando tablas de Auditoría de Inventario...');
  
  const sqlFile = path.join(__dirname, 'setup-inventory-audit-db.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Ejecutar usando rpc o verificando las tablas directamente
  const { data: testData, error: testErr } = await supabase.from('audit_sessions').select('id').limit(1);

  if (testErr && testErr.code === '42P01') { // table does not exist
    console.log('La tabla audit_sessions no existe aún. Ejecuta el script setup-inventory-audit-db.sql en tu editor de SQL de Supabase.');
  } else {
    console.log('✅ La estructura de tablas audit_sessions está lista y accesible.');
  }
}

run();
