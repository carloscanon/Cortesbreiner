const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

fetch(url + '/rest/v1/individual_garments?select=*&limit=1', {
  headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
