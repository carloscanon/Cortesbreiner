import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: homologations, error: hErr } = await supabase
      .from('product_homologations')
      .select(`
        *,
        master_product:products!product_homologations_master_product_id_fkey(id, nombre_producto, codigo_referencia, categoria, category_id),
        source_product:products!product_homologations_source_product_id_fkey(id, nombre_producto, codigo_referencia, categoria, category_id)
      `)
      .order('created_at', { ascending: false });

    if (hErr) {
      console.error('Error fetching homologations:', hErr);
      return NextResponse.json({ error: hErr.message }, { status: 500 });
    }

    const { data: logs, error: lErr } = await supabase
      .from('homologation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (lErr) {
      console.error('Error fetching homologation logs:', lErr);
    }

    return NextResponse.json({
      success: true,
      homologations: homologations || [],
      logs: logs || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error de servidor.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = await req.json();

    const { items, userEmail, actionType, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La lista de homologaciones está vacía.' }, { status: 400 });
    }

    const inserts: any[] = [];
    const logEntries: any[] = [];

    for (const item of items) {
      const masterCode = (item.masterCode || item.master_code || '').trim();
      const sourceCode = (item.sourceCode || item.source_code || '').trim();
      const masterProductId = item.masterProductId || item.master_product_id || null;
      const sourceProductId = item.sourceProductId || item.source_product_id || null;
      const matchPct = item.matchPercentage ?? item.match_percentage ?? 100;
      const matchType = item.matchType || item.match_type || 'manual';

      if (!masterCode || !sourceCode) continue;

      inserts.push({
        master_product_id: masterProductId,
        master_code: masterCode,
        source_code: sourceCode,
        source_product_id: sourceProductId,
        match_percentage: matchPct,
        match_type: matchType,
        notes: item.notes || notes || 'Homologación registrada',
        created_by: userEmail || 'Sistema',
        status: 'Activo'
      });
    }

    if (inserts.length === 0) {
      return NextResponse.json({ error: 'No se encontraron registros válidos para homologar.' }, { status: 400 });
    }

    const { data: created, error: insErr } = await supabase
      .from('product_homologations')
      .insert(inserts)
      .select();

    if (insErr) {
      console.error('Error inserting homologations:', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Insert audit log entries
    if (created && created.length > 0) {
      const logs = created.map(h => ({
        homologation_id: h.id,
        action: actionType || 'CREACION',
        user_email: userEmail || 'Sistema',
        details: {
          master_code: h.master_code,
          source_code: h.source_code,
          match_type: h.match_type
        }
      }));
      await supabase.from('homologation_logs').insert(logs);
    }

    return NextResponse.json({
      success: true,
      count: created?.length || 0,
      homologations: created
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al guardar homologación.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userEmail = searchParams.get('userEmail') || 'Sistema';

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID de la homologación.' }, { status: 400 });
    }

    // Fetch before updating to get details for audit
    const { data: existing } = await supabase
      .from('product_homologations')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'No se encontró la homologación especificada.' }, { status: 444 });
    }

    // Update status to Revertido instead of hard delete to preserve history
    const { error: updErr } = await supabase
      .from('product_homologations')
      .update({ status: 'Revertido', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('homologation_logs').insert({
      homologation_id: id,
      action: 'REVERSION',
      user_email: userEmail,
      details: {
        master_code: existing.master_code,
        source_code: existing.source_code,
        reverted_at: new Date().toISOString()
      }
    });

    return NextResponse.json({ success: true, message: 'Homologación revertida con éxito.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al revertir homologación.' }, { status: 500 });
  }
}
