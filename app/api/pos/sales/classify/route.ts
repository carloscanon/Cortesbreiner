import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function updateObsWithConcept(currentObs: string | null | undefined, concept: string): string {
  let base = (currentObs || '').trim();
  // Remove existing [CONCEPTO: ...] tags if present
  base = base.replace(/\|\s*\[CONCEPTO:[^\]]+\]/gi, '').replace(/\[CONCEPTO:[^\]]+\]/gi, '').trim();
  if (base) {
    return `${base} | [CONCEPTO: ${concept}]`;
  }
  return `[CONCEPTO: ${concept}]`;
}

export async function POST(request: Request) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { saleIds, conceptName } = body;

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json({ error: 'saleIds debe ser un arreglo con al menos un ID de venta' }, { status: 400 });
    }

    if (!conceptName || typeof conceptName !== 'string') {
      return NextResponse.json({ error: 'conceptName es requerido y debe ser un texto' }, { status: 400 });
    }

    const trimmedConcept = conceptName.trim();

    // Fetch existing sales to retain any prior notes
    const { data: sales, error: fetchErr } = await supabase
      .from('pos_sales')
      .select('id, consecutive, observaciones')
      .in('id', saleIds);

    if (fetchErr) {
      return NextResponse.json({ error: `Error al consultar ventas: ${fetchErr.message}` }, { status: 500 });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const sale of (sales || [])) {
      const newObs = updateObsWithConcept(sale.observaciones, trimmedConcept);

      // Attempt update with both concepto_venta and observaciones
      let updateRes = await supabase
        .from('pos_sales')
        .update({
          observaciones: newObs,
          concepto_venta: trimmedConcept
        })
        .eq('id', sale.id);

      // If column concepto_venta doesn't exist in DB schema cache yet, fall back to just observaciones
      if (updateRes.error && updateRes.error.message.includes('concepto_venta')) {
        updateRes = await supabase
          .from('pos_sales')
          .update({
            observaciones: newObs
          })
          .eq('id', sale.id);
      }

      if (updateRes.error) {
        errors.push(`Venta #${sale.consecutive}: ${updateRes.error.message}`);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      totalRequested: saleIds.length,
      concept: trimmedConcept,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error in POST /api/pos/sales/classify:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
