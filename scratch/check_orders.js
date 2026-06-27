const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL="(.*)"/)[1].trim();
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY="(.*)"/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: cuts } = await supabase.from('cuts').select('*').limit(1);
  if (cuts && cuts.length > 0) {
    console.log('Cuts table columns:', Object.keys(cuts[0]));
  }
}

main();
