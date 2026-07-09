import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Filtros
    const q            = searchParams.get('q') || '';
    const custId       = searchParams.get('customer_identification') || '';
    const dateStart    = searchParams.get('date_start') || '';
    const dateEnd      = searchParams.get('date_end') || '';
    const minTotal     = searchParams.get('min_total') || '';
    const maxTotal     = searchParams.get('max_total') || '';
    const statusDian   = searchParams.get('status_dian') || '';

    // Paginación y orden
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage  = Math.min(100, parseInt(searchParams.get('per_page') || '20', 10));
    const sortBy   = searchParams.get('sort_by') || 'date';
    const sortAsc  = searchParams.get('sort_order') === 'asc';

    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    let query = supabaseAdmin
      .from('siigo_invoices')
      .select(
        '*, siigo_customers(name, city_name, state_name, vendedor_name, riesgo, cupo_credito, saldo_mora)',
        { count: 'exact' }
      )
      .order(sortBy, { ascending: sortAsc })
      .range(from, to);

    // ── Filtros opcionales ──
    if (q)         query = query.or(`consecutive.ilike.%${q}%,observations.ilike.%${q}%`);
    if (custId)    query = query.eq('customer_identification', custId);
    if (dateStart) query = query.gte('date', dateStart);
    if (dateEnd)   query = query.lte('date', dateEnd);
    if (minTotal)  query = query.gte('total', parseFloat(minTotal));
    if (maxTotal)  query = query.lte('total', parseFloat(maxTotal));
    if (statusDian) query = query.ilike('status_dian', `%${statusDian}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    // Totales y resumen del conjunto filtrado (sin paginación) para los KPIs
    let summaryQuery = supabaseAdmin
      .from('siigo_invoices')
      .select('total');
    if (q)         summaryQuery = summaryQuery.or(`consecutive.ilike.%${q}%,observations.ilike.%${q}%`);
    if (custId)    summaryQuery = summaryQuery.eq('customer_identification', custId);
    if (dateStart) summaryQuery = summaryQuery.gte('date', dateStart);
    if (dateEnd)   summaryQuery = summaryQuery.lte('date', dateEnd);
    if (minTotal)  summaryQuery = summaryQuery.gte('total', parseFloat(minTotal));
    if (maxTotal)  summaryQuery = summaryQuery.lte('total', parseFloat(maxTotal));

    const { data: allTotals } = await summaryQuery;
    const totalVentas  = allTotals?.reduce((s, r) => s + (r.total || 0), 0) ?? 0;
    const ticketProm   = allTotals?.length ? totalVentas / allTotals.length : 0;
    const maxFactura   = allTotals?.length ? Math.max(...allTotals.map(r => r.total || 0)) : 0;

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        perPage,
        totalRows: count ?? 0,
        totalPages: count ? Math.ceil(count / perPage) : 0
      },
      summary: {
        totalVentas,
        totalFacturas: count ?? 0,
        ticketPromedio: ticketProm,
        maxFactura
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
