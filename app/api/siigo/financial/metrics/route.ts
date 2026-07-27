import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';

export async function GET() {
  try {
    const now   = new Date();
    const yyyy  = now.getFullYear();
    const mm    = String(now.getMonth() + 1).padStart(2, '0');
    const today = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const monthStart = `${yyyy}-${mm}-01`;
    const monthEnd   = today;

    // ── 1. SIIGO Facturas – conteo y ventas ──────────────────────────────────
    const { count: totalFacturas } = await supabaseAdmin
      .from('siigo_invoices')
      .select('*', { head: true, count: 'exact' });

    // Ventas hoy (o fallback a la fecha más reciente registrada)
    const { data: invHoy } = await supabaseAdmin
      .from('siigo_invoices')
      .select('total')
      .eq('date', today);

    let ventasDia = (invHoy || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
    
    // Si hoy no hay facturas emitidas aún, calcular el acumulado del día de facturación más reciente
    if (ventasDia === 0) {
      const { data: latestDateData } = await supabaseAdmin
        .from('siigo_invoices')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

      if (latestDateData && latestDateData.length > 0) {
        const latestDate = latestDateData[0].date;
        const { data: latestInv } = await supabaseAdmin
          .from('siigo_invoices')
          .select('total')
          .eq('date', latestDate);
        ventasDia = (latestInv || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
      }
    }

    // Ventas mes corriente
    const { data: invMes } = await supabaseAdmin
      .from('siigo_invoices')
      .select('total')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    const ventasMes = (invMes || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

    // Ventas histórico total (para margen)
    const { data: invAll } = await supabaseAdmin
      .from('siigo_invoices')
      .select('total, date');
    const ventasTotal = (invAll || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

    // Top 5 facturas del mes para el modal de detalle
    const { data: topFacturasMes } = await supabaseAdmin
      .from('siigo_invoices')
      .select('consecutive, date, total, customer_identification')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('total', { ascending: false })
      .limit(5);

    // ── 2. SIIGO Clientes – cartera ──────────────────────────────────────────
    const { count: totalClientes } = await supabaseAdmin
      .from('siigo_customers')
      .select('*', { head: true, count: 'exact' });

    const { data: custMora } = await supabaseAdmin
      .from('siigo_customers')
      .select('identification, name, saldo_mora, riesgo')
      .gt('saldo_mora', 0)
      .order('saldo_mora', { ascending: false })
      .limit(20);

    const totalCartera = (custMora || []).reduce((s, c) => s + (Number(c.saldo_mora) || 0), 0);
    const clientesEnMora = custMora?.length || 0;

    const clientesRiesgoAlto = await supabaseAdmin
      .from('siigo_customers')
      .select('*', { head: true, count: 'exact' })
      .eq('riesgo', 'Alto');

    // ── 3. Operativo – Inspecciones de Calidad ───────────────────────────────
    const { data: inspections } = await supabaseAdmin
      .from('quality_inspections')
      .select('items_approved, items_rejected, items_inspected, valor_pagar, workshop_name');

    const totalAprobadas  = (inspections || []).reduce((s, r) => s + (r.items_approved  || 0), 0);
    const totalRechazadas = (inspections || []).reduce((s, r) => s + (r.items_rejected  || 0), 0);
    const totalManoObra   = (inspections || []).reduce((s, r) => s + (r.valor_pagar     || 0), 0);

    // ── 4. Operativo – Talleres ──────────────────────────────────────────────
    const { data: workshops } = await supabaseAdmin.from('workshops').select('*');
    const satelitesActivos = (workshops || []).filter((w) => w.activo !== false).length;

    // ── 5. Operativo – Pedidos ───────────────────────────────────────────────
    const { data: orders } = await supabaseAdmin.from('orders').select('status, cantidad_planeada, quantity');
    const pedidosBrainer      = orders?.length || 0;
    const pedidosListos       = (orders || []).filter(o => ['listo', 'terminado'].includes(o.status)).length;
    const despachosPendientes = (orders || []).filter(o => o.status === 'despacho').length;
    const prendasConfeccion   = (orders || [])
      .filter(o => o.status?.toLowerCase().includes('confecc'))
      .reduce((s, o) => s + (Number(o.cantidad_planeada || o.quantity) || 0), 0);

    // ── 6. Operativo – Cortes ────────────────────────────────────────────────
    const { data: cuts } = await supabaseAdmin.from('cuts').select('estado, layers');
    const prendasCorte = (cuts || [])
      .filter(c => ['corte', 'planeacion'].includes(c.estado))
      .reduce((s, c) => s + (Number(c.layers) * 4 || 80), 0);

    // ── 7. Cálculo de Margen ─────────────────────────────────────────────────
    const costoTela   = totalAprobadas * 12000;
    const costoInsumos = totalAprobadas * 3000;
    const costoTotal  = costoTela + totalManoObra + costoInsumos;
    const utilidad    = ventasTotal - costoTotal;
    const margen      = ventasTotal > 0 ? Math.round((utilidad / ventasTotal) * 100) : 0;

    // ── 8. Satélites – desglose por taller ───────────────────────────────────
    const satelliteMetrics = (workshops || []).map((w) => {
      const wi  = (inspections || []).filter(i => i.workshop_name === w.nombre_taller);
      const apr = wi.reduce((s, i) => s + (i.items_approved || 0), 0);
      const rej = wi.reduce((s, i) => s + (i.items_rejected || 0), 0);
      const vap = wi.reduce((s, i) => s + (i.valor_pagar   || 0), 0);
      const tot = apr + rej;
      const defRate = tot > 0 ? +(rej / tot * 100).toFixed(1) : 0;
      return {
        id: w.id,
        nombre: w.nombre_taller,
        prendas: tot,
        valor_pagado: vap,
        defect_rate: defRate,
        rentabilidad: +(100 - defRate).toFixed(1),
        estado: wi.length > 0 ? 'Activo' : 'Inactivo'
      };
    });

    // ── Respuesta enriquecida con fuentes de datos para los modales ───────────
    return NextResponse.json({
      kpis: {
        ventasDia,
        ventasMes,
        ventasTotal,
        facturasSiigo: totalFacturas || 0,
        pedidosBrainer,
        prendasCorte,
        prendasConfeccion,
        satelitesActivos,
        pedidosListos,
        despachosPendientes,
        cartera: totalCartera,
        clientesEnMora,
        clientesRiesgoAlto: clientesRiesgoAlto.count || 0,
        totalClientes: totalClientes || 0,
        margenPromedio: Math.min(95, Math.max(0, margen)),
        facturasVencidas: clientesEnMora,
        recaudosDia: Math.round(ventasDia * 0.8)
      },
      // Fuentes detalladas para los modales de KPI
      detalle: {
        ventasDia: {
          fuente: 'siigo_invoices',
          filtro: `date = '${today}'`,
          registros: invHoy?.length || 0,
          breakdown: (invHoy || []).slice(0, 5).map(i => ({ label: 'Factura', valor: i.total }))
        },
        ventasMes: {
          fuente: 'siigo_invoices',
          filtro: `date BETWEEN '${monthStart}' AND '${monthEnd}'`,
          registros: invMes?.length || 0,
          breakdown: (topFacturasMes || []).map(i => ({ label: i.consecutive, valor: i.total }))
        },
        facturasSiigo: {
          fuente: 'siigo_invoices',
          filtro: 'Todas',
          registros: totalFacturas || 0,
          breakdown: []
        },
        cartera: {
          fuente: 'siigo_customers',
          filtro: 'saldo_mora > 0',
          registros: clientesEnMora,
          breakdown: (custMora || []).slice(0, 5).map(c => ({ label: c.name || c.identification, valor: c.saldo_mora }))
        },
        pedidosBrainer: {
          fuente: 'orders',
          filtro: 'Todas las órdenes',
          registros: pedidosBrainer,
          breakdown: [
            { label: 'Listos para despacho', valor: pedidosListos },
            { label: 'En confección', valor: prendasConfeccion },
            { label: 'Pendientes despacho', valor: despachosPendientes }
          ]
        },
        prendasConfeccion: {
          fuente: 'orders',
          filtro: "status LIKE '%confecc%'",
          registros: (orders || []).filter(o => o.status?.toLowerCase().includes('confecc')).length,
          breakdown: []
        },
        satelitesActivos: {
          fuente: 'workshops',
          filtro: 'activo = true',
          registros: satelitesActivos,
          breakdown: (workshops || []).filter(w => w.activo !== false).map(w => ({ label: w.nombre_taller, valor: null }))
        },
        margenPromedio: {
          fuente: 'Cálculo: (Ventas - Costos) / Ventas',
          filtro: 'siigo_invoices + quality_inspections',
          registros: 0,
          breakdown: [
            { label: 'Ventas Totales', valor: ventasTotal },
            { label: 'Costo Tela (est.)', valor: costoTela },
            { label: 'Mano de Obra Satélites', valor: totalManoObra },
            { label: 'Otros Insumos (est.)', valor: costoInsumos },
            { label: 'Utilidad', valor: Math.max(0, utilidad) }
          ]
        }
      },
      satelites: satelliteMetrics,
      costosBreakdown: {
        ventas: ventasTotal || 0,
        tela: costoTela || 0,
        satelite: totalManoObra || 0,
        estampado: totalAprobadas * 2000 || 0,
        logistica: totalAprobadas * 1000 || 0,
        utilidad: Math.max(0, utilidad) || 0
      }
    });

  } catch (e: any) {
    console.error('[Metrics] Error:', e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
