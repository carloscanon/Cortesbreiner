import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const customerId = searchParams.get('customer_identification') || '';

    let query = supabaseAdmin
      .from('siigo_invoices')
      .select('*, siigo_customers(name, city_name, city_code, state_name, vendedor_name, riesgo, cupo_credito, saldo_mora)')
      .order('date', { ascending: false });

    if (q) {
      query = query.ilike('consecutive', `%${q}%`);
    }
    if (customerId) {
      query = query.eq('customer_identification', customerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
