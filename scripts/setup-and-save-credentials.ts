import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../lib/integration/shared/crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no está configurada.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Iniciando inicialización de tablas SIIGO e inserción de credenciales...');

  // 1. Crear las tablas de SIIGO usando queries RPC o asumiendo que ya existen.
  // Como el cliente de REST directo no tiene rpc.exec_sql por seguridad,
  // recomendamos que el usuario corra el setup-siigo.sql. 
  // No obstante, intentaremos insertar directamente la configuración en erp_config.

  const username = 'febrainershop@gmail.com';
  const accessKey = 'ZTJlOGE0M2UtZTc0OC00MTAyLWJmMjUtNGE4NzU5MGQ2NGUxOm42TjhCMz52MkQ=';
  const accessKeyEncrypted = encrypt(accessKey);

  console.log('Encriptando Access Key...');

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
