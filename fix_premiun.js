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
    let totalUpdated = 0;
    while (true) {
      const { data: garments } = await supabase
        .from('individual_garments')
        .select('id, reference_name')
        .ilike('reference_name', '%premiun%')
        .limit(1000);

      if (!garments || garments.length === 0) {
        console.log("No more garments with 'premiun' found.");
        break;
      }

      console.log(`Processing batch of ${garments.length} garments...`);
      
      const batchSize = 100;
      for (let i = 0; i < garments.length; i += batchSize) {
        const batch = garments.slice(i, i + batchSize);
        const promises = batch.map(g => {
          const newName = g.reference_name.replace(/premiun/gi, match => {
            if (match === 'PREMIUN') return 'PREMIUM';
            if (match === 'Premiun') return 'Premium';
            if (match === 'premiun') return 'premium';
            return 'Premium';
          });
          return supabase.from('individual_garments').update({ reference_name: newName }).eq('id', g.id);
        });
        
        await Promise.all(promises);
      }
      totalUpdated += garments.length;
      console.log(`Updated ${totalUpdated} total garments so far...`);
    }
    console.log("Done. Total updated:", totalUpdated);
  } catch (err) {
    console.error(err);
  }
})();
