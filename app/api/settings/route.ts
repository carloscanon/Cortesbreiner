import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { name, value, fileBase64, fileName } = body;

    // Si nos pasan un archivo codificado en Base64, lo subimos al Storage mediante el cliente Admin
    let finalValue = value;
    if (fileBase64 && fileName) {
      const buffer = Buffer.from(fileBase64, 'base64');
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('logos')
        .upload(fileName, buffer, {
          contentType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        return NextResponse.json({ error: `Error subiendo archivo al almacenamiento: ${uploadError.message}` }, { status: 500 });
      }

      // Obtener la URL pública utilizando el cliente Admin
      const { data: { publicUrl } } = supabaseAdmin.storage.from('logos').getPublicUrl(fileName);
      finalValue = publicUrl;
    }

    if (!name || finalValue === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros: name y value son requeridos' }, { status: 400 });
    }

    // Upsert en la base de datos (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from('company_params')
      .upsert({ name, value: finalValue, description: name === 'theme_primary_color' ? 'Color primario del tema' : undefined }, { onConflict: 'name' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, value: finalValue, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
