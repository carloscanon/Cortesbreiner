import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { SiigoClient } from '../../../../../lib/integration/siigo/client';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Consultar facturas de hoy registradas en Supabase (o facturas globales ordenadas por fecha)
    let { data: invHoy } = await supabaseAdmin
      .from('siigo_invoices')
      .select('*, siigo_customers(name, identification, vendedor_name)')
      .eq('date', today)
      .order('created_at', { ascending: false });

    // Si no hay facturas de hoy registradas aún, cargar las facturas más recientes
    if (!invHoy || invHoy.length === 0) {
      const { data: latestInvoices } = await supabaseAdmin
        .from('siigo_invoices')
        .select('*, siigo_customers(name, identification, vendedor_name)')
        .order('date', { ascending: false })
        .limit(20);
      invHoy = latestInvoices || [];
    }

    const totalVentasHoy = (invHoy || []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    return NextResponse.json({
      success: true,
      today,
      totalInvoices: invHoy?.length || 0,
      totalVentasHoy,
      invoices: invHoy || []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch today's invoices directly from SIIGO API via request method
    const response = await SiigoClient.request('GET', `/invoices?created_start=${today}&created_end=${today}&page=1`);
    const invoices = response?.results || [];

    let insertedCount = 0;
    for (const inv of invoices) {
      const invRecord = {
        siigo_id: String(inv.id),
        consecutive: String(inv.name || inv.number || inv.id),
        date: inv.date || today,
        customer_identification: String(inv.customer?.identification || ''),
        total: Number(inv.total || 0),
        status_dian: inv.dian_status || 'Aceptado DIAN',
        observations: inv.observations || '',
        cufe: inv.cufe || ''
      };

      const { error } = await supabaseAdmin
        .from('siigo_invoices')
        .upsert(invRecord, { onConflict: 'siigo_id' });

      if (!error) insertedCount++;
    }

    // Return updated totals for today
    let { data: invHoy } = await supabaseAdmin
      .from('siigo_invoices')
      .select('*, siigo_customers(name, identification, vendedor_name)')
      .eq('date', today)
      .order('created_at', { ascending: false });

    if (!invHoy || invHoy.length === 0) {
      const { data: latestInvoices } = await supabaseAdmin
        .from('siigo_invoices')
        .select('*, siigo_customers(name, identification, vendedor_name)')
        .order('date', { ascending: false })
        .limit(20);
      invHoy = latestInvoices || [];
    }

    const totalVentasHoy = (invHoy || []).reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    return NextResponse.json({
      success: true,
      today,
      syncedCount: insertedCount,
      totalInvoices: invHoy?.length || 0,
      totalVentasHoy,
      invoices: invHoy || []
    });
  } catch (error: any) {
    console.error('Error syncing today sales from SIIGO:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
