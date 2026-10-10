import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: setting, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('key', 'pos_store_monthly_targets')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message, targets: {} }, { status: 500 });
    }

    let targets: Record<string, number> = {};
    if (setting?.value) {
      try {
        targets = JSON.parse(setting.value);
      } catch (e) {
        targets = {};
      }
    }

    return NextResponse.json({ success: true, targets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, targets: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { store_id, meta_mensual, targets: bulkTargets } = body;

    // 1. Fetch current targets map from settings in DB
    const { data: currentSetting } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('key', 'pos_store_monthly_targets')
      .maybeSingle();

    let targetsMap: Record<string, number> = {};
    if (currentSetting?.value) {
      try {
        targetsMap = JSON.parse(currentSetting.value);
      } catch (e) {
        targetsMap = {};
      }
    }

    if (bulkTargets && typeof bulkTargets === 'object') {
      Object.entries(bulkTargets).forEach(([k, v]) => {
        targetsMap[k] = Number(v) || 0;
      });
    }

    if (store_id) {
      targetsMap[store_id] = Number(meta_mensual) || 0;
    }

    // 2. Persist updated map into settings table in DB
    const { error: upsertError } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'pos_store_monthly_targets',
        value: JSON.stringify(targetsMap),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (upsertError) {
      console.error('Error updating pos_store_monthly_targets in settings table:', upsertError);
      return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 });
    }

    // 3. If meta_mensual column exists on stores table, try updating it as well
    if (store_id) {
      try {
        await supabaseAdmin
          .from('stores')
          .update({ meta_mensual: Number(meta_mensual) || 0 })
          .eq('id', store_id);
      } catch (e) {
        // Safe ignore if column is not directly on stores
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Meta mensual guardada exitosamente en la base de datos',
      targets: targetsMap
    });
  } catch (err: any) {
    console.error('API /api/stores/meta error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
