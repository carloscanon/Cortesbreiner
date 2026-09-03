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

    const { pairs, userEmail, notes } = body;

    if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({ error: 'No hay pares de productos para consolidar.' }, { status: 400 });
    }

    let homologatedCount = 0;
    let newProductsCount = 0;
    let totalUnitsConsolidated = 0;

    const inserts: any[] = [];
    const logs: any[] = [];

    for (const pair of pairs) {
      const masterCode = (pair.masterCode || pair.master_code || '').trim();
      const sourceCode = (pair.sourceCode || pair.source_code || '').trim();
      const masterProductId = pair.masterProductId || pair.master_product_id || null;
      const sourceProductId = pair.sourceProductId || pair.source_product_id || null;
      const matchPct = pair.matchPercentage ?? pair.match_percentage ?? 100;
      const matchType = pair.matchType || pair.match_type || 'exacta';
      const sourceQty = Number(pair.sourceStock || pair.qty || 0);

      if (!masterCode) continue;

      if (sourceCode && sourceCode !== masterCode) {
        inserts.push({
          master_product_id: masterProductId,
          master_code: masterCode,
          source_code: sourceCode,
          source_product_id: sourceProductId,
          match_percentage: matchPct,
          match_type: matchType,
          notes: pair.notes || notes || 'Consolidación asistida',
          created_by: userEmail || 'Sistema',
          status: 'Activo'
        });
        homologatedCount++;
        totalUnitsConsolidated += sourceQty;
      } else {
        newProductsCount++;
      }
    }

    let createdHomologations: any[] = [];
    if (inserts.length > 0) {
      const { data: created, error: insErr } = await supabase
        .from('product_homologations')
        .insert(inserts)
        .select();

      if (insErr) {
        console.error('Error in consolidation batch insert:', insErr);
        return NextResponse.json({ error: 'Error guardando consolidación: ' + insErr.message }, { status: 500 });
      }

      createdHomologations = created || [];

      // Create logs
      const logInserts = createdHomologations.map(h => ({
        homologation_id: h.id,
        action: 'CONSOLIDACION_WIZARD',
        user_email: userEmail || 'Sistema',
        details: {
          master_code: h.master_code,
          source_code: h.source_code,
          match_type: h.match_type,
          batch_size: inserts.length
        }
      }));
      await supabase.from('homologation_logs').insert(logInserts);
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalAnalyzed: pairs.length,
        homologatedCount,
        newProductsCount,
        pendingReviewCount: 0,
        duplicatesCount: 0,
        totalUnitsConsolidated
      },
      homologations: createdHomologations
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error durante la consolidación.' }, { status: 500 });
  }
}
