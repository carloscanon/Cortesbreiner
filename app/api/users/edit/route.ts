import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { userId, full_name, role_id, workshop_id, newPassword, avatarBase64, avatarName } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario es obligatorio.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let avatar_url = undefined;

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

    // Update password if provided
    if (newPassword && newPassword.trim() !== '') {
      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });
      if (pwdError) {
        return NextResponse.json({ error: `Error actualizando contraseña: ${pwdError.message}` }, { status: 400 });
      }
    }

    // Update auth user metadata (where we can freely store workshop_id as text/comma list)
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name, role_id, workshop_id }
    });
    if (metadataError) {
      console.error('Error updating auth metadata:', metadataError.message);
    }

    // Build profiles update payload (excluding workshop_id to prevent UUID database errors)
    const updatePayload: any = {
      full_name,
      role_id: role_id || null,
    };
    if (avatar_url !== undefined) {
      updatePayload.avatar_url = avatar_url;
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json({ error: `Error actualizando perfil: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
