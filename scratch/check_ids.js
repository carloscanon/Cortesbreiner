const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  try {
    // Get last 3 orders
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (oErr) throw oErr;

    for (const order of orders) {
      console.log(`\nOrder OC-${order.internal_code} (id: ${order.id}):`);
      const { data: cuts, error: cErr } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', order.id);

      if (cErr) throw cErr;

      console.log(`Found ${cuts?.length} cuts:`);
      for (const cut of cuts || []) {
        console.log(`  Cut id: ${cut.id}`);
        console.log(`    product_id: ${cut.product_id}`);
        console.log(`    color_id: ${cut.color_id}`);
        console.log(`    fabric_id: ${cut.fabric_id}`);
        console.log(`    layers: ${cut.layers}`);
        
        // Check if product exists in DB
        if (cut.product_id) {
          const { data: prod } = await supabase.from('products').select('*').eq('id', cut.product_id).single();
          console.log(`    Product in DB:`, prod ? `${prod.nombre_producto} (cat: ${prod.category_id})` : 'NOT FOUND');
        }
        // Check if color exists in DB
        if (cut.color_id) {
          const { data: col } = await supabase.from('colors').select('*').eq('id', cut.color_id).single();
          console.log(`    Color in DB:`, col ? col.nombre_color : 'NOT FOUND');
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

check();
