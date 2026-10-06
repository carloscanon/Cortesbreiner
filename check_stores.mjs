import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="(.*)"/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.*)"/)[1];

const supabase = createClient(url, key);

async function check() {
  const { data } = await supabase.from('stores').select('*');
  console.dir(data, { depth: null });
}

check();
