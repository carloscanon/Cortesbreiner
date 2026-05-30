const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectCuts() {
  console.log('Fetching orders and their cuts to analyze the matrix structure...');
  
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, brand, consecutive')
    .order('consecutive', { ascending: false })
    .limit(10);

  if (ordersErr) {
    console.error('Error fetching orders:', ordersErr);
    return;
  }

  for (const order of orders) {
    const { data: cuts, error: cutsErr } = await supabase
      .from('cuts')
      .select('*, cut_sizes(*)')
      .eq('order_id', order.id);

    if (cutsErr) {
      console.error(`Error fetching cuts for order ${order.consecutive}:`, cutsErr);
      continue;
    }

    console.log(`\nOrder #${order.consecutive} (ID: ${order.id}) | Brand: ${order.brand}`);
    console.log(`  Total cuts found: ${cuts.length}`);
    cuts.forEach((cut, i) => {
      const sizes = cut.cut_sizes.map(cs => `SizeID: ${cs.size_id} Qty: ${cs.quantity}`).join(', ');
      console.log(`    Cut #${i+1}: ID: ${cut.id} | ColorID: ${cut.color_id} | ProductID: ${cut.product_id} | Layers: ${cut.layers} | Kilos: ${cut.kilos}`);
      console.log(`      Sizes: [${sizes}]`);
    });
  }
}

inspectCuts();
