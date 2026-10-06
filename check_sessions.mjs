import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="(.*)"/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.*)"/)[1];

const supabase = createClient(url, key);

async function check() {
  await supabase.from('pos_cash_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Deleted sessions');
}

check();
