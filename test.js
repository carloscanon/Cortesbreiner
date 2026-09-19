const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  if (line.includes('=')) {
    const [k, ...v] = line.split('=');
    acc[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  }
  return acc;
}, {});
fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/sewing_orders?select=id,status,parent_order_id,workshop_id,confeccion_code&order=created_at.desc&limit=10', {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
}).then(r => r.json()).then(d => console.dir(d, {depth:null}));
