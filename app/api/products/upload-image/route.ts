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
    const { fileBase64, fileName } = body;

    if (!fileBase64 || !fileName) {
      return NextResponse.json({ error: 'Faltan parámetros: fileBase64 y fileName son requeridos' }, { status: 400 });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    
    // Determine content type
    let contentType = 'image/jpeg';
    if (fileName.toLowerCase().endsWith('.png')) contentType = 'image/png';
    else if (fileName.toLowerCase().endsWith('.webp')) contentType = 'image/webp';
    else if (fileName.toLowerCase().endsWith('.gif')) contentType = 'image/gif';

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      return NextResponse.json({ error: `Error subiendo archivo al almacenamiento: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage.from('product-images').getPublicUrl(fileName);

    return NextResponse.json({ success: true, publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
