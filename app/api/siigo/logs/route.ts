import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit')) || 50;
    const offset = Number(searchParams.get('offset')) || 0;
    const method = searchParams.get('method') || '';
    const status = searchParams.get('status') || '';

    let query = supabase
      .from('erp_logs')
      .select('*', { count: 'exact' })
      .eq('erp_name', 'SIIGO')
      .order('created_at', { ascending: false });

    if (method) {
      query = query.eq('method', method);
    }

    if (status) {
      if (status === 'error') {
        query = query.or('status_code.gte.400,status_code.is.null');
      } else if (status === 'success') {
        query = query.lt('status_code', 400).gt('status_code', 199);
      }
    }

    const { data: logs, count, error } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    // Obtener también logs de auditoría
    const { data: audit, error: auditErr } = await supabase
      .from('erp_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (auditErr) throw auditErr;

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      audit: audit || []
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
