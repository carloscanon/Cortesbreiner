const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase
    .from('individual_garments')
    .update({ warehouse_id: '65797b78-39c1-4078-9475-80d7385823a6' })
    .eq('barcode', '0081970557')
    .select();
  console.log("DATA:", data);
  console.log("ERROR:", error);
})();
