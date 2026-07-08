const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Leer y parsear .env.local de forma nativa
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join('=').trim();
          // Quitar comillas si tiene
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          }
          process.env[key] = val;
        }
      }
    });
  }
} catch (e) {
  console.error('Error leyendo .env.local:', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Replicamos la encriptación de crypto.ts
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'default-secret-fallback-key-32-chars',
  'salt-siigo',
  32
);
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

async function run() {
  const username = 'febrainershop@gmail.com';
  const accessKey = 'ZTJlOGE0M2UtZTc0OC00MTAyLWJmMjUtNGE4NzU5MGQ2NGUxOm42TjhCMz52MkQ=';
  const accessKeyEncrypted = encrypt(accessKey);

  console.log('Guardando credenciales encriptadas en Supabase...');

  const { error } = await supabase
    .from('erp_config')
    .upsert({
      erp_name: 'SIIGO',
      api_url: 'https://api.siigo.com/v1',
      environment: 'sandbox',
      username: username,
      access_key_encrypted: accessKeyEncrypted,
      partner_id: '',
      timeout_ms: 10000,
      max_retries: 3,
      retry_delay_ms: 1000,
      headers: {},
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'erp_name' });

  if (error) {
    if (error.code === '42P01') {
      console.error('\n⚠️  La tabla "erp_config" no existe en la base de datos de Supabase.');
      console.error('Por favor, ejecuta primero el script SQL "scripts/setup-siigo.sql" en el editor SQL de tu panel de Supabase.');
    } else {
      console.error('Error al guardar credenciales:', error.message);
    }
    process.exit(1);
  }

  console.log('✅ Credenciales de SIIGO guardadas y encriptadas correctamente en Supabase.');
}

run();
