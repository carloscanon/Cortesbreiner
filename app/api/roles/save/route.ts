import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id, name, description = '', permissions = [] } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del rol es obligatorio.' }, { status: 400 });
    }

    let roleId = id;

    if (roleId) {
      // Update existing role
      const { data: updatedRole, error: updateError } = await supabaseAdmin
        .from('roles')
        .update({ name: name.trim(), description })
        .eq('id', roleId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: `Error actualizando rol: ${updateError.message}` }, { status: 500 });
      }
    } else {
      // Insert new role
      const { data: newRole, error: insertError } = await supabaseAdmin
        .from('roles')
        .insert([{ name: name.trim(), description }])
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: `Error creando rol: ${insertError.message}` }, { status: 500 });
      }
      roleId = newRole.id;
    }

    // Replace role permissions
    // 1. Delete previous permissions
    const { error: delError } = await supabaseAdmin
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    if (delError) {
      console.warn('Error clearing existing role permissions:', delError.message);
    }

    // 2. Insert new permissions if any
    if (Array.isArray(permissions) && permissions.length > 0) {
      const permsToInsert = permissions.map((pId: string) => ({
        role_id: roleId,
        permission_id: pId
      }));

      const { error: insPermsError } = await supabaseAdmin
        .from('role_permissions')
        .insert(permsToInsert);

      if (insPermsError) {
        return NextResponse.json({ error: `Error asignando permisos: ${insPermsError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      roleId, 
      message: 'Rol y permisos guardados exitosamente.' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
