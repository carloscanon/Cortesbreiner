const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.trim().startsWith('#')) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function testFetchAll(whId) {
  let garmentQuery = supabase
    .from('individual_garments')
    .select('id, barcode, reference_name, color_name, size_code, status, warehouse_id, store_id, created_at, defect_checklist')
    .neq('status', 'Vendido')
    .neq('status', 'vendido')
    .order('created_at', { ascending: false })
    .eq('warehouse_id', whId);

  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await garmentQuery.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error('Error in fetchAllPages:', error);
      break;
    }
    if (data && data.length > 0) {
      // Filter out is_sold in JS
      const validGarments = data.filter(g => {
        if (g.defect_checklist && typeof g.defect_checklist === 'object') {
          if (g.defect_checklist.is_sold === true || g.defect_checklist.is_sold === 'true') {
            return false;
          }
        }
        return true;
      });
      allData = [...allData, ...validGarments];
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`Wh: ${whId} -> Total fetched: ${allData.length}`);
  const sample = allData.find(g => g.barcode === '0082007980');
  console.log('Prenda 0082007980 found:', sample ? 'SI' : 'NO');
  if (sample) console.log(sample);
}

async function run() {
  const NUEVA_LOCAL1 = 'ef962be9-4a7c-481b-b5b4-65099cae0ed1';
  await testFetchAll(NUEVA_LOCAL1);
}
run();
