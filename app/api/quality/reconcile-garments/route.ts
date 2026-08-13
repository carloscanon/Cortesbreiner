import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const {
      orderDetailId,
      isSewingOrder,
      parentOrderId,
      savedInspectionId,
      rowApproved,
      rowRejected,
      detailRows
    } = body;

    if (!orderDetailId) {
      return NextResponse.json({ error: 'Falta orderDetailId.' }, { status: 400 });
    }

    // 1. Obtener prendas existentes de la base de datos
    const query = supabaseAdmin.from('individual_garments').select('*');
    if (isSewingOrder) {
      query.eq('sewing_order_id', orderDetailId);
    } else {
      query.eq('order_id', orderDetailId);
    }
    const { data: garments, error: garmentErr } = await query;
    if (garmentErr) {
      return NextResponse.json({ error: 'Error al consultar prendas: ' + garmentErr.message }, { status: 500 });
    }

    const inserts: any[] = [];
    const updates: any[] = [];
    const deletes: string[] = [];

    // 2. Reconciliar prendas individuales
    (detailRows || []).forEach((row: any) => {
      const approvedQty = Number(rowApproved?.[row.key]) || 0;
      const rejectedQty = Number(rowRejected?.[row.key]) || 0;
      const sizeCode = row.size || 'ST';

      // Helper de coincidencia flexible de nombre de referencia
      const isRefMatch = (garmentRef: string, rowProdName: string) => {
        if (!garmentRef || !rowProdName) return false;
        const gClean = garmentRef.replace(/\s*\[.*?\]/g, '').trim().toUpperCase();
        const rClean = rowProdName.replace(/\s*\[.*?\]/g, '').trim().toUpperCase();
        if (gClean === rClean) return true;

        const gFirst = gClean.split(' ')[0];
        const rFirst = rClean.split(' ')[0];
        const gSecond = gClean.split(' ')[1] || '';
        const rSecond = rClean.split(' ')[1] || '';

        const gPrefix = (gFirst + ' ' + gSecond).trim();
        const rPrefix = (rFirst + ' ' + rSecond).trim();

        return gClean.includes(rPrefix) || rClean.includes(gPrefix) || (gFirst.length >= 3 && gFirst === rFirst);
      };

      // Filtrar existentes para esta combinación (coincidencia flexible de referencia)
      const existing = (garments || []).filter(g =>
        isRefMatch(g.reference_name || '', row.productName || '') &&
        (g.color_name || '').toUpperCase().trim() === (row.colorName || '').toUpperCase().trim() &&
        (g.size_code || '').toUpperCase().trim() === (row.size || '').toUpperCase().trim()
      );

      const targets: string[] = [];
      for (let i = 0; i < approvedQty; i++) targets.push('Aprobada');
      for (let i = 0; i < rejectedQty; i++) targets.push('Rechazada');

      const maxLen = Math.max(existing.length, targets.length);
      for (let i = 0; i < maxLen; i++) {
        const g = existing[i];
        const targetStatus = targets[i];

        if (g && targetStatus) {
          // Ambos existen: check if status changed o inspection_id falta
          const needsUpdate = g.status !== targetStatus || (savedInspectionId && g.quality_inspection_id !== savedInspectionId);
          if (needsUpdate) {
            updates.push({
              id: g.id,
              status: targetStatus,
              quality_inspection_id: savedInspectionId || g.quality_inspection_id || null
            });
          }
        } else if (targetStatus) {
          // No existe: INSERT
          inserts.push({
            sewing_order_id: isSewingOrder ? orderDetailId : null,
            order_id: isSewingOrder ? (parentOrderId || null) : orderDetailId,
            quality_inspection_id: savedInspectionId || null,
            barcode: '', 
            reference_name: row.productName,
            color_name: row.colorName,
            size_code: sizeCode,
            status: targetStatus,
            defect_checklist: {}
          });
        } else if (g) {
          // No hay target: DELETE
          deletes.push(g.id);
        }
      }
    });

    // 3. Asignar códigos de barras a las inserciones
    if (inserts.length > 0) {
      // 1. Intentar buscar el código de barra de 10 dígitos más alto
      let { data: maxGarment, error: maxErr } = await supabaseAdmin
        .from('individual_garments')
        .select('barcode')
        .like('barcode', '__________') // 10 guiones bajos para exactamente 10 caracteres
        .order('barcode', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxErr) {
        return NextResponse.json({ error: 'Error al consultar código de barras (10 dgt): ' + maxErr.message }, { status: 500 });
      }

      // 2. Si no hay de 10 dígitos, buscar el de 8 dígitos más alto como fallback
      if (!maxGarment?.barcode) {
        const fallbackQuery = await supabaseAdmin
          .from('individual_garments')
          .select('barcode')
          .like('barcode', '________') // 8 guiones bajos para exactamente 8 caracteres
          .order('barcode', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackQuery.error) {
          return NextResponse.json({ error: 'Error al consultar código de barras (8 dgt): ' + fallbackQuery.error.message }, { status: 500 });
        }
        maxGarment = fallbackQuery.data;
      }

      let maxGlobalSeq = 0;
      if (maxGarment?.barcode) {
        const num = parseInt(maxGarment.barcode, 10);
        if (!isNaN(num)) {
          maxGlobalSeq = num;
        }
      }

      inserts.forEach(ins => {
        maxGlobalSeq++;
        ins.barcode = maxGlobalSeq.toString().padStart(10, '0');
      });
    }

    // 4. Ejecutar cambios en la DB con rol de servicio
    if (deletes.length > 0) {
      const { error: delErr } = await supabaseAdmin.from('individual_garments').delete().in('id', deletes);
      if (delErr) {
        return NextResponse.json({ error: 'Error al borrar prendas: ' + delErr.message }, { status: 500 });
      }
    }

    if (updates.length > 0) {
      const results = await Promise.all(updates.map(upd =>
        supabaseAdmin.from('individual_garments').update({
          status: upd.status,
          quality_inspection_id: upd.quality_inspection_id
        }).eq('id', upd.id)
      ));
      const failed = results.find(r => r.error);
      if (failed) {
        return NextResponse.json({ error: 'Error al actualizar prendas: ' + (failed.error?.message || 'Error desconocido') }, { status: 500 });
      }
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('individual_garments').insert(inserts);
      if (insErr) {
        return NextResponse.json({ error: 'Error al insertar prendas: ' + insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno.' }, { status: 500 });
  }
}
