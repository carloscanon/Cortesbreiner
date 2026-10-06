const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=\"(.*?)\"/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
  try {
    const { data: warehouses } = await supabase.from('warehouses').select('id, nombre_bodega').eq('estado', 'activo');
    let defaultWarehouse = warehouses.find(w => w.nombre_bodega.toLowerCase().includes('principal')) || warehouses[0];
    
    let totalUpdated = 0;
    while (true) {
      const { data: garments } = await supabase
        .from('individual_garments')
        .select('id, quality_inspection_id, is_historical')
        .is('warehouse_id', null)
        .in('status', ['Aprobada', 'Recibido'])
        .limit(1000);

      if (!garments || garments.length === 0) break;

      const inspectionIds = [...new Set(garments.map(g => g.quality_inspection_id).filter(id => id))];
      const { data: inspections } = await supabase.from('quality_inspections').select('id, closed_at').in('id', inspectionIds);
      const closedInspectionIds = new Set(inspections.filter(i => i.closed_at).map(i => i.id));

      const idsToUpdate = garments
        .filter(g => g.is_historical || !g.quality_inspection_id || closedInspectionIds.has(g.quality_inspection_id))
        .map(g => g.id);

      if (idsToUpdate.length === 0) {
        // Break to avoid infinite loop if there are rows that don't match closed inspection criteria
        console.log("No more matching garments to update in this batch. Stopping.");
        break; 
      }

      const batchSize = 50;
      for (let i = 0; i < idsToUpdate.length; i += batchSize) {
        const batch = idsToUpdate.slice(i, i + batchSize);
        const { error: updErr } = await supabase
          .from('individual_garments')
          .update({ warehouse_id: defaultWarehouse.id })
          .in('id', batch);
        if (updErr) { console.error("Batch update error:", updErr); } 
      }
      totalUpdated += idsToUpdate.length;
      console.log(`Updated ${totalUpdated} total garments so far...`);
    }
    console.log("Done. Total updated:", totalUpdated);
  } catch (err) {
    console.error(err);
  }
})();
