const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTg3MjgsImV4cCI6MjA5NDE3NDcyOH0.hGXk8Q_M4hvbn3aEJI9HNCepyoOzwyR5apFJzdUx7b4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUnique() {
  console.log('Testing inserting fabrics with same codigo_tela but different invoices...');
  
  // 1. Fetch one existing fabric
  const { data: existing, error: fetchErr } = await supabase.from('fabrics').select('*').limit(1);
  if (fetchErr) {
    console.error('Error fetching fabrics:', fetchErr);
    return;
  }
  
  if (!existing || existing.length === 0) {
    console.log('No existing fabrics found, inserting a new test fabric...');
    const testCode = 'TEST-CODE-' + Math.floor(Math.random() * 1000);
    const f1 = {
      codigo_tela: testCode,
      nombre_tela: 'Test Fabric 1',
      factura_relacionada: 'INV-1'
    };
    const f2 = {
      codigo_tela: testCode,
      nombre_tela: 'Test Fabric 2',
      factura_relacionada: 'INV-2'
    };
    
    const { data: r1, error: e1 } = await supabase.from('fabrics').insert([f1]).select();
    if (e1) {
      console.error('Failed to insert first fabric:', e1);
      return;
    }
    console.log('Inserted first fabric:', r1);
    
    const { data: r2, error: e2 } = await supabase.from('fabrics').insert([f2]).select();
    if (e2) {
      console.log('Failed to insert second fabric (there is a unique constraint!):', e2.message);
    } else {
      console.log('Successfully inserted second fabric! NO unique constraint on codigo_tela.');
      // Cleanup
      await supabase.from('fabrics').delete().in('id', [r1[0].id, r2[0].id]);
    }
  } else {
    const original = existing[0];
    console.log(`Original fabric: ID=${original.id}, Code=${original.codigo_tela}, Invoice=${original.factura_relacionada}`);
    
    const duplicate = {
      codigo_tela: original.codigo_tela,
      nombre_tela: original.nombre_tela + ' (Duplicate)',
      factura_relacionada: 'INV-TEST-DUP-' + Math.floor(Math.random() * 1000)
    };
    
    const { data: inserted, error: insertErr } = await supabase.from('fabrics').insert([duplicate]).select();
    if (insertErr) {
      console.log('Insert failed (there is a unique constraint on codigo_tela!):', insertErr.message);
    } else {
      console.log('Insert succeeded! There is NO unique constraint on codigo_tela.', inserted);
      // Cleanup
      await supabase.from('fabrics').delete().eq('id', inserted[0].id);
    }
  }
}

testUnique();
