import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = await req.json();

    const {
      auditId,
      actionType, // 'REQUEST_ADJUSTMENT', 'APPROVE_ADJUSTMENT', 'JUSTIFY_ITEM'
      itemId,
      justification,
      userEmail,
      reason,
      notes
    } = body;

    if (!auditId) {
      return NextResponse.json({ error: 'Se requiere auditId.' }, { status: 400 });
    }

    // ACTION 1: Justify a single item difference
    if (actionType === 'JUSTIFY_ITEM' && itemId) {
      const { error: updErr } = await supabase
        .from('audit_items')
        .update({
          item_state: 'Justificada',
          justification: justification || 'Diferencia auditada y justificada'
        })
        .eq('id', itemId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'JUSTIFICACION',
        user_email: userEmail || 'Sistema',
        after_state: { itemId, justification }
      });

      return NextResponse.json({ success: true, message: 'Diferencia justificada.' });
    }

    // ACTION 2: Request inventory adjustment
    if (actionType === 'REQUEST_ADJUSTMENT') {
      const { data: session } = await supabase.from('audit_sessions').select('*').eq('id', auditId).single();
      if (!session) return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });

      const { data: reqData, error: reqErr } = await supabase
        .from('audit_adjustment_requests')
        .insert({
          audit_id: auditId,
          requested_by: userEmail || 'Auditor',
          status: 'Pendiente',
          total_items_to_adjust: (session.total_missing_qty || 0) + (session.total_surplus_qty || 0),
          total_financial_impact: session.financial_impact || 0,
          reason: reason || 'Ajuste por diferencias detectadas en auditoría física',
          notes: notes || ''
        })
        .select()
        .single();

      if (reqErr) {
        return NextResponse.json({ error: reqErr.message }, { status: 500 });
      }

      await supabase.from('audit_sessions').update({ status: 'En Revision' }).eq('id', auditId);

      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'SOLICITUD_AJUSTE',
        user_email: userEmail || 'Auditor',
        after_state: { requestId: reqData.id, reason }
      });

      return NextResponse.json({ success: true, request: reqData, message: 'Solicitud de ajuste enviada a aprobación.' });
    }

    // ACTION 3: APPROVE ADJUSTMENT & UPDATE DB INVENTORY IMMUTABLY
    if (actionType === 'APPROVE_ADJUSTMENT') {
      const { data: session } = await supabase.from('audit_sessions').select('*').eq('id', auditId).single();
      if (!session) return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });

      const { data: items } = await supabase.from('audit_items').select('*').eq('audit_id', auditId);

      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No hay ítems registrados en la auditoría.' }, { status: 400 });
      }

      let adjustedCount = 0;

      for (const item of items) {
        const diff = (item.counted_qty || 0) - (item.expected_qty || 0);
        if (diff === 0) continue;

        // Apply delta to finished_goods_stock if product_id exists
        if (item.product_id && session.location_id) {
          const { data: currentStock } = await supabase
            .from('finished_goods_stock')
            .select('*')
            .eq('product_id', item.product_id)
            .eq('warehouse_id', session.location_id)
            .maybeSingle();

          const prevQty = currentStock ? Number(currentStock.cantidad_disponible || 0) : 0;
          const newQty = Math.max(0, prevQty + diff);

          if (currentStock) {
            await supabase
              .from('finished_goods_stock')
              .update({ cantidad_disponible: newQty, updated_at: new Date().toISOString() })
              .eq('id', currentStock.id);
          } else if (newQty > 0) {
            await supabase.from('finished_goods_stock').insert({
              product_id: item.product_id,
              color_id: item.color_id || null,
              size_id: item.size_id || null,
              warehouse_id: session.location_id,
              cantidad_disponible: newQty
            });
          }

          // Register Kardex movement in database
          await supabase.from('finished_goods_kardex').insert({
            product_id: item.product_id,
            color_id: item.color_id || null,
            size_id: item.size_id || null,
            warehouse_dest_id: session.location_id,
            tipo_movimiento: diff > 0 ? 'Ajuste Auditoría (Sobrante)' : 'Ajuste Auditoría (Faltante)',
            cantidad: Math.abs(diff),
            saldo_anterior: prevQty,
            saldo_nuevo: newQty,
            documento_origen: `AUDITORÍA #${session.consecutive}`,
            usuario: userEmail || 'Aprobador',
            observaciones: `Ajuste autorizado por auditoría #${session.consecutive}`
          });
        }

        // Update item status in DB
        await supabase.from('audit_items').update({ item_state: 'Ajustada' }).eq('id', item.id);
        adjustedCount++;
      }

      // Update session status to Ajustado / Cerrado
      await supabase.from('audit_sessions').update({
        status: 'Ajustado',
        approved_by: userEmail || 'Aprobador',
        closed_at: new Date().toISOString()
      }).eq('id', auditId);

      // Update adjustment requests to Aprobado
      await supabase.from('audit_adjustment_requests').update({
        status: 'Aprobado',
        approved_by: userEmail || 'Aprobador',
        approved_at: new Date().toISOString()
      }).eq('audit_id', auditId);

      // Write Immutable Audit Log in DB
      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'APROBACION',
        user_email: userEmail || 'Aprobador',
        before_state: { total_expected: session.total_expected_qty },
        after_state: {
          status: 'Ajustado',
          adjusted_items: adjustedCount,
          approved_by: userEmail || 'Aprobador'
        }
      });

      return NextResponse.json({
        success: true,
        message: `✅ Auditoría #${session.consecutive} ajustada y cerrada con éxito (${adjustedCount} ítems actualizados en inventario).`
      });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al procesar ajuste.' }, { status: 500 });
  }
}
