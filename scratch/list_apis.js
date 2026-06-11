const SUPABASE_URL = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SERVICE_KEY}`);
  const data = await r.json();
  console.log('Keys:', Object.keys(data));
  if (data.paths) {
    console.log('All Paths:', Object.keys(data.paths));
  }
}

main().catch(console.error);
