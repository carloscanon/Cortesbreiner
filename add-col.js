const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
const url = env.find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].replace(/["']/g, '').trim();
const key = env.find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/["']/g, '').trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);
async function run() {
  const { error } = await supabase.from('pos_sales').select('observaciones').limit(1);
  if (error && error.code === '42703') {
     console.log('Column does not exist. Adding column...');
     // Can't run raw SQL easily without RPC, so I will print that the column is missing
     console.log('MISSING');
  } else {
     console.log('Column exists or other error:', error);
  }
}
run();
