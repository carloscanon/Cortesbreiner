import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role_id, workshop_id, pos_role_id, avatarBase64, avatarName } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, contraseña y nombre son obligatorios.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validatedRoleId = (role_id && uuidRegex.test(role_id)) ? role_id : null;

    if (!validatedRoleId) {
      // Fallback: search for first available role in public.roles to keep trigger happy
      const { data: dbRoles } = await supabaseAdmin.from('roles').select('id');
      if (dbRoles && dbRoles.length > 0) {
        validatedRoleId = dbRoles[0].id;
      }
    }

    let avatar_url = undefined;

    // Crear usuario en Auth (sin requerir confirmación de email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role_id: validatedRoleId, workshop_id: workshop_id || null, pos_role_id: pos_role_id || null }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'No se pudo obtener el ID del usuario creado.' }, { status: 500 });
    }

    // Upload avatar to Storage if provided
    if (avatarBase64 && avatarName) {
      const buffer = Buffer.from(avatarBase64, 'base64');
      const uniqueFileName = `avatar-${userId}-${Date.now()}-${avatarName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('logos')
        .upload(uniqueFileName, buffer, {
          contentType: avatarName.endsWith('.png') ? 'image/png' : 'image/jpeg',
          upsert: true
        });

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage.from('logos').getPublicUrl(uniqueFileName);
        avatar_url = publicUrl;
      } else {
        console.error('Error uploading avatar:', uploadError.message);
      }
    }

    // Esperar brevemente para que el trigger handle_new_user cree el perfil
    await new Promise(resolve => setTimeout(resolve, 500));

    // Build profile payload (excluding workshop_id to prevent UUID database errors)
    const profilePayload: any = {
      id: userId,
      full_name,
      role_id: role_id || null,
    };
    if (avatar_url) {
      profilePayload.avatar_url = avatar_url;
    }

    // Actualizar el perfil con el nombre completo y rol
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      console.error('Error updating profile:', profileError.message);
    }

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
