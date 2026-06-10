import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos la service role key en el servidor para saltar las políticas de RLS de forma segura
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const body = await request.json();
    const { name, value } = body;

    if (!name || value === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros: name y value son requeridos' }, { status: 400 });
    }

    // Upsert usando el cliente administrador (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from('company_params')
      .upsert({ name, value, description: name === 'theme_primary_color' ? 'Color primario del tema' : undefined }, { onConflict: 'name' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
