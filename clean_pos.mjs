import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="(.*)"/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.*)"/)[1];

const supabase = createClient(url, key);

async function clean() {
  console.log("Limpiando store_kardex...");
  await supabase.from('store_kardex').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Limpiando pos_payments...");
  await supabase.from('pos_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Limpiando pos_sale_items...");
  await supabase.from('pos_sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Limpiando pos_sales...");
  await supabase.from('pos_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Limpiando store_cash_sessions...");
  await supabase.from('store_cash_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("Limpieza completada.");
}

clean();
