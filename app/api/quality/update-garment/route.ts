import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const { garmentId, updates } = body;

    const finalUpdates = { ...updates };
    if (finalUpdates.status === 'Rechazada') {
      finalUpdates.warehouse_id = '710e4d52-771c-4ca5-a24b-83ba1aa9dc04'; // Bodega Rechazos
    }

    const { data, error } = await supabaseAdmin
      .from('individual_garments')
      .update(finalUpdates)
      .eq('id', garmentId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno.' }, { status: 500 });
  }
}
